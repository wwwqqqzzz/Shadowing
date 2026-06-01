import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Progress } from './entities/progress.entity';
import { Material } from '../materials/entities/material.entity';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Progress)
    private readonly progressRepo: Repository<Progress>,
  ) {}

  async saveProgress(
    userId: string,
    materialId: string,
    sentenceOrder: number,
    totalSentences: number,
  ): Promise<Progress> {
    const existing = await this.progressRepo.findOne({
      where: { user: { id: userId }, material: { id: materialId } },
    });

    if (existing) {
      existing.sentenceOrder = sentenceOrder;
      existing.totalSentences = totalSentences;
      return this.progressRepo.save(existing);
    }

    const progress = this.progressRepo.create({
      user: { id: userId } as any,
      material: { id: materialId } as any,
      sentenceOrder,
      totalSentences,
    });
    return this.progressRepo.save(progress);
  }

  async getProgress(
    userId: string,
    materialId: string,
  ): Promise<Progress | null> {
    return this.progressRepo.findOne({
      where: { user: { id: userId }, material: { id: materialId } },
    });
  }

  async getBatchProgress(
    userId: string,
    materialIds: string[],
  ): Promise<
    Record<string, { sentenceOrder: number; totalSentences: number; percent: number }>
  > {
    if (materialIds.length === 0) return {};

    const rawRows = await this.progressRepo
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .addSelect('p.sentenceOrder', 'sentenceOrder')
      .addSelect('p.totalSentences', 'totalSentences')
      .addSelect('p.materialId', 'materialId')
      .where('p.userId = :userId', { userId })
      .andWhere('p.materialId IN (:...materialIds)', { materialIds })
      .getRawMany();

    const result: Record<string, { sentenceOrder: number; totalSentences: number; percent: number }> = {};
    for (const r of rawRows) {
      result[r.materialId] = {
        sentenceOrder: Number(r.sentenceOrder),
        totalSentences: Number(r.totalSentences),
        percent: Math.round((Number(r.sentenceOrder) / Number(r.totalSentences)) * 100),
      };
    }
    return result;
  }

  async getLatestProgress(userId: string) {
    const row = await this.progressRepo
      .createQueryBuilder('p')
      .where('p.userId = :userId', { userId })
      .orderBy('p.updatedAt', 'DESC')
      .getOne();

    if (!row) return null;

    const matId = (row as any).materialId;
    const mat = await this.progressRepo.manager.findOne(Material, { where: { id: matId } });
    if (!mat) return null;

    return {
      material: {
        id: mat.id,
        title: mat.title,
        audioUrl: mat.audioUrl,
        level: mat.level,
        accent: mat.accent || 'american',
        source: mat.source,
        totalSentences: row.totalSentences,
      },
      lastSentenceOrder: row.sentenceOrder,
      totalSentences: row.totalSentences,
      progressPercent: Math.round(
        (row.sentenceOrder / row.totalSentences) * 100,
      ),
    };
  }
}