import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from './entities/material.entity';
import { Sentence } from '../sentences/entities/sentence.entity';
import { parseVtt } from './vtt-parser';

export interface MaterialWithCount {
  id: string;
  title: string;
  language: string;
  level: string;
  coverUrl: string;
  audioUrl: string;
  durationMs: number;
  status: string;
  source: string;
  createdAt: Date;
  sentenceCount: number;
}

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,
    @InjectRepository(Sentence)
    private readonly sentenceRepo: Repository<Sentence>,
  ) {}

  async findAll(
    query?: {
      language?: string;
      level?: string;
      status?: string;
    },
  ): Promise<MaterialWithCount[]> {
    const qb = this.materialRepo
      .createQueryBuilder('m')
      .leftJoin('m.sentences', 's')
      .select('m.id', 'id')
      .addSelect('m.title', 'title')
      .addSelect('m.language', 'language')
      .addSelect('m.level', 'level')
      .addSelect('m.coverUrl', 'coverUrl')
      .addSelect('m.audioUrl', 'audioUrl')
      .addSelect('m.durationMs', 'durationMs')
      .addSelect('m.status', 'status')
      .addSelect('m.source', 'source')
      .addSelect('m.createdAt', 'createdAt')
      .addSelect('COUNT(s.id)', 'sentenceCount')
      .groupBy('m.id');

    if (query?.language) qb.andWhere('m.language = :language', { language: query.language });
    if (query?.level) qb.andWhere('m.level = :level', { level: query.level });
    if (query?.status) {
      qb.andWhere('m.status = :status', { status: query.status });
    } else {
      qb.andWhere('m.status = :status', { status: 'published' });
    }

    qb.orderBy('m.createdAt', 'DESC');

    const rawRows = await qb.getRawMany();
    return rawRows.map((row) => ({
      id: row.id,
      title: row.title,
      language: row.language,
      level: row.level,
      coverUrl: row.coverUrl,
      audioUrl: row.audioUrl,
      durationMs: Number(row.durationMs),
      status: row.status,
      source: row.source,
      createdAt: row.createdAt,
      sentenceCount: Number(row.sentenceCount),
    }));
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