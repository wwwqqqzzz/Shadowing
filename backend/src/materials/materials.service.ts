import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from './entities/material.entity';
import { Sentence } from '../sentences/entities/sentence.entity';
import { ProgressService } from '../progress/progress.service';
import { parseVtt } from './vtt-parser';

export interface MaterialWithCount {
  id: string;
  title: string;
  language: string;
  level: string;
  accent: string;
  coverUrl: string;
  audioUrl: string;
  durationMs: number;
  status: string;
  source: string;
  createdAt: Date;
  sentenceCount: number;
  progress?: { sentenceOrder: number; totalSentences: number; percent: number } | null;
}

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,
    @InjectRepository(Sentence)
    private readonly sentenceRepo: Repository<Sentence>,
    private readonly progressService: ProgressService,
  ) {}

  async findAll(
    query?: {
      language?: string;
      level?: string;
      status?: string;
      accent?: string;
      duration?: string;
    },
    userId?: string | null,
  ): Promise<MaterialWithCount[]> {
    const qb = this.materialRepo
      .createQueryBuilder('m')
      .leftJoin('m.sentences', 's')
      .select('m.id', 'id')
      .addSelect('m.title', 'title')
      .addSelect('m.language', 'language')
      .addSelect('m.level', 'level')
      .addSelect('m.accent', 'accent')
      .addSelect('m.coverUrl', 'coverUrl')
      .addSelect('m.audioUrl', 'audioUrl')
      .addSelect('m.durationMs', 'durationMs')
      .addSelect('m.audioOffsetMs', 'audioOffsetMs')
      .addSelect('m.status', 'status')
      .addSelect('m.source', 'source')
      .addSelect('m.createdAt', 'createdAt')
      .addSelect('COUNT(s.id)', 'sentenceCount')
      .addGroupBy('m.id');

    if (query?.language) qb.andWhere('m.language = :language', { language: query.language });
    if (query?.level) qb.andWhere('m.level = :level', { level: query.level });
    if (query?.accent) qb.andWhere('m.accent = :accent', { accent: query.accent });
    if (query?.status) {
      qb.andWhere('m.status = :status', { status: query.status });
    } else {
      qb.andWhere('m.status = :status', { status: 'published' });
    }
    if (query?.duration === 'short') qb.andWhere('m.durationMs < 300000');
    if (query?.duration === 'medium') qb.andWhere('m.durationMs BETWEEN 300000 AND 900000');
    if (query?.duration === 'long') qb.andWhere('m.durationMs >= 900000');

    qb.orderBy('m.createdAt', 'DESC');

    const rawRows = await qb.getRawMany();
    const results = rawRows.map((row) => ({
      id: row.id,
      title: row.title,
      language: row.language,
      level: row.level,
      accent: row.accent,
      coverUrl: row.coverUrl,
      audioUrl: row.audioUrl,
      durationMs: Number(row.durationMs),
      audioOffsetMs: Number(row.audioOffsetMs || 0),
      status: row.status,
      source: row.source,
      createdAt: row.createdAt,
      sentenceCount: Number(row.sentenceCount),
    }));

    // merge progress when authenticated
    if (userId) {
      const materialIds = results.map((r) => r.id);
      const progressMap = await this.progressService.getBatchProgress(userId, materialIds);
      return results.map((r) => ({
        ...r,
        progress: progressMap[r.id] || null,
      }));
    }

    return results;
  }

  async findById(id: string): Promise<Material> {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    return material;
  }

  async findSentencesByMaterialId(materialId: string) {
    const material = await this.materialRepo.findOne({
      where: { id: materialId },
      relations: { sentences: true },
    });
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    return material.sentences.sort((a, b) => a.order - b.order);
  }

  async importFromVtt(params: {
    vttContent: string;
    audioFilename: string;
    title: string;
    source: string;
    level: string;
    audioOffsetMs?: number;
  }): Promise<{
    materialId: string;
    sentenceCount: number;
    durationMs: number;
    preview: Array<{ order: number; startTime: number; text: string }>;
  }> {
    const { sentences, durationMs } = parseVtt(params.vttContent);

    const material = this.materialRepo.create({
      title: params.title,
      language: 'en',
      level: params.level,
      audioUrl: params.audioFilename,
      source: params.source,
      durationMs,
      audioOffsetMs: params.audioOffsetMs || 0,
      status: 'draft',
      sentences: sentences.map((s, i) =>
        this.sentenceRepo.create({
          order: i + 1,
          startTime: s.startTime,
          endTime: s.endTime,
          text: s.text,
        }),
      ),
    });

    const saved = await this.materialRepo.save(material);

    return {
      materialId: saved.id,
      sentenceCount: saved.sentences.length,
      durationMs,
      preview: saved.sentences.slice(0, 5).map((s) => ({
        order: s.order,
        startTime: s.startTime,
        text: s.text,
      })),
    };
  }

  async updateStatus(
    id: string,
    status: string,
  ): Promise<{ id: string; status: string }> {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    material.status = status;
    const saved = await this.materialRepo.save(material);
    return { id: saved.id, status: saved.status };
  }

  async updateMaterial(id: string, data: { accent?: string; level?: string; status?: string }) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    Object.assign(material, data);
    const saved = await this.materialRepo.save(material);
    return { id: saved.id, accent: saved.accent, level: saved.level, status: saved.status };
  }

  async updateOffset(
    id: string,
    audioOffsetMs: number,
  ): Promise<{ id: string; audioOffsetMs: number }> {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    material.audioOffsetMs = audioOffsetMs;
    const saved = await this.materialRepo.save(material);
    return { id: saved.id, audioOffsetMs: saved.audioOffsetMs };
  }

  async deleteMaterial(id: string): Promise<{ success: true }> {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    await this.materialRepo.remove(material);
    return { success: true };
  }

  async updateSentence(
    id: string,
    data: { order?: number; startTime?: number; endTime?: number; text?: string; audioUrl?: string },
  ): Promise<Sentence> {
    const sentence = await this.sentenceRepo.findOne({ where: { id } });
    if (!sentence) {
      throw new NotFoundException('Sentence not found');
    }
    Object.assign(sentence, data);
    return this.sentenceRepo.save(sentence);
  }
}