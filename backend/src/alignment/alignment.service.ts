import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import { resolve, basename } from 'path';
import { existsSync } from 'fs';
import { Material } from '../materials/entities/material.entity';
import { Sentence } from '../sentences/entities/sentence.entity';

export interface AlignmentResult {
  materialId: string;
  status: 'success' | 'failed' | 'skipped';
  sentencesTotal: number;
  sentencesAligned: number;
  coverage: number;
  durationMs: number;
  error?: string;
}

/**
 * AlignmentService orchestrates automatic wordTimings generation.
 *
 * Strategy: spawn the existing scripts/align_sentences.py as a child process.
 * - Whisper is a heavy Python/PyTorch dependency, rewriting in TS is impractical
 * - The Python script has a proven, tested pipeline with --from-db + --update-wordtimings
 * - The script uses safe mode (only updates wordTimings column, preserves translations)
 */
@Injectable()
export class AlignmentService {
  private readonly logger = new Logger(AlignmentService.name);

  // Track currently running alignments so we can prevent concurrent runs on the same material
  // Track in-flight alignments so we can prevent concurrent runs on the same material
  private readonly runningAlignments = new Set<string>();

  constructor(
    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,
    @InjectRepository(Sentence)
    private readonly sentenceRepo: Repository<Sentence>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Public entry point. Aligns a material by spawning the Python script.
   * Resolves audio file path from material.audioUrl + tmp directory.
   */
  async alignMaterial(
    materialId: string,
    options: {
      model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
      async?: boolean;
    } = {},
  ): Promise<AlignmentResult> {
    const model = options.model ?? 'base';

    if (this.runningAlignments.has(materialId)) {
      this.logger.warn(
        `Alignment already running for material ${materialId}, skipping`,
      );
      return {
        materialId,
        status: 'skipped',
        sentencesTotal: 0,
        sentencesAligned: 0,
        coverage: 0,
        durationMs: 0,
        error: 'Alignment already running for this material',
      };
    }

    const material = await this.materialRepo.findOne({
      where: { id: materialId },
    });
    if (!material) {
      throw new Error(`Material ${materialId} not found`);
    }

    const audioPath = this.resolveAudioPath(material.audioUrl);
    if (!existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    if (options.async) {
      void this.runAlignment(materialId, audioPath, model).catch((err) => {
        this.logger.error(
          `Background alignment failed for ${materialId}: ${err.message}`,
        );
      });
      return {
        materialId,
        status: 'success',
        sentencesTotal: 0,
        sentencesAligned: 0,
        coverage: 0,
        durationMs: 0,
      };
    }

    return this.runAlignment(materialId, audioPath, model);
  }

  /**
   * Resolve the absolute path of the audio file.
   * Audio files are saved to tmp/ on import (see admin-materials.controller.ts:30).
   * The audioUrl is just the filename (e.g., "1234567890-podcast.mp3").
   */
  private resolveAudioPath(audioUrl: string): string {
    const projectRoot = this.findProjectRoot();
    const tmpDir = resolve(projectRoot, 'tmp');
    return resolve(tmpDir, basename(audioUrl));
  }

  private findProjectRoot(): string {
    let dir = resolve(__dirname);
    while (!existsSync(resolve(dir, 'miniprogram'))) {
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
    return dir;
  }

  /**
   * Spawn the Python alignment script and wait for completion.
   */
  private async runAlignment(
    materialId: string,
    audioPath: string,
    model: string,
  ): Promise<AlignmentResult> {
    this.runningAlignments.add(materialId);
    const startTime = Date.now();

    try {
      const projectRoot = this.findProjectRoot();
      const scriptPath = resolve(projectRoot, 'scripts', 'align_sentences.py');

      if (!existsSync(scriptPath)) {
        throw new Error(`Alignment script not found: ${scriptPath}`);
      }

      const connParams = {
        DATABASE_HOST: this.configService.get('database.host') || 'localhost',
        DATABASE_PORT: String(this.configService.get('database.port') || 5432),
        DATABASE_USER: this.configService.get('database.user') || 'wang',
        DATABASE_PASS: this.configService.get('database.pass') || '',
        DATABASE_NAME:
          this.configService.get('database.name') || 'shadowing_dev',
      };

      const args = [
        scriptPath,
        '--audio',
        audioPath,
        '--from-db',
        '--material-id',
        materialId,
        '--update-wordtimings',
        '--model',
        model,
      ];

      this.logger.log(`Spawning alignment: python3 ${args.join(' ')}`);

      const result = await this.spawnPython(args, connParams);

      const coverage = await this.getCoverage(materialId);
      const total = await this.sentenceRepo.count({
        where: { material: { id: materialId } },
      });

      const durationMs = Date.now() - startTime;

      if (result.exitCode !== 0) {
        return {
          materialId,
          status: 'failed',
          sentencesTotal: total,
          sentencesAligned: coverage.aligned,
          coverage: coverage.ratio,
          durationMs,
          error: result.stderr.slice(-500),
        };
      }

      this.logger.log(
        `Alignment complete: ${coverage.aligned}/${total} (${(coverage.ratio * 100).toFixed(1)}%) in ${(durationMs / 1000).toFixed(1)}s`,
      );

      return {
        materialId,
        status: 'success',
        sentencesTotal: total,
        sentencesAligned: coverage.aligned,
        coverage: coverage.ratio,
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Alignment failed for ${materialId}: ${message}`);
      return {
        materialId,
        status: 'failed',
        sentencesTotal: 0,
        sentencesAligned: 0,
        coverage: 0,
        durationMs,
        error: message,
      };
    } finally {
      this.runningAlignments.delete(materialId);
    }
  }

  /**
   * Spawn python3 as child process and capture output.
   */
  private spawnPython(
    args: string[],
    env: Record<string, string>,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn('python3', args, { env: { ...process.env, ...env } });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        chunk.split('\n').forEach((line) => {
          if (line.trim()) this.logger.debug(`[python] ${line}`);
        });
      });

      child.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        chunk.split('\n').forEach((line) => {
          if (line.trim()) this.logger.warn(`[python] ${line}`);
        });
      });

      child.on('close', (code) => {
        resolve({ exitCode: code ?? -1, stdout, stderr });
      });

      child.on('error', (err) => {
        this.logger.error(`Failed to spawn python3: ${err.message}`);
        resolve({ exitCode: -1, stdout, stderr: stderr + `\n${err.message}` });
      });
    });
  }

  /**
   * Query DB for coverage stats.
   */
  private async getCoverage(
    materialId: string,
  ): Promise<{ aligned: number; ratio: number }> {
    const result = await this.sentenceRepo
      .createQueryBuilder('s')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE s."wordTimings" IS NOT NULL)`,
        'aligned',
      )
      .where('s."materialId" = :materialId', { materialId })
      .getRawOne<{ total: string; aligned: string }>();

    const total = parseInt(result?.total || '0', 10);
    const aligned = parseInt(result?.aligned || '0', 10);
    return { aligned, ratio: total > 0 ? aligned / total : 0 };
  }
}
