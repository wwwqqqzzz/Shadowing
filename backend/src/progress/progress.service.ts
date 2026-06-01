import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Progress } from './entities/progress.entity';

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

    const records = await this.progressRepo.find({
      where: materialIds.map((id) => ({
        user: { id: userId },
        material: { id },
      })),
    });

    const result: Record<string, { sentenceOrder: number; totalSentences: number; percent: number }> = {};
    for (const r of records) {
      const matId = (r.material as any).id;
      result[matId] = {
        sentenceOrder: r.sentenceOrder,
        totalSentences: r.totalSentences,
        percent: Math.round((r.sentenceOrder / r.totalSentences) * 100),
      };
    }
    return result;
  }

  async getLatestProgress(userId: string) {
    const progress = await this.progressRepo.findOne({
      where: { user: { id: userId } },
      relations: { material: true },
      order: { updatedAt: 'DESC' },
    });

    if (!progress) return null;

    return {
      material: {
        id: (progress.material as any).id,
        title: (progress.material as any).title,
        audioUrl: (progress.material as any).audioUrl,
        level: (progress.material as any).level,
        accent: (progress.material as any).accent || 'american',
        source: (progress.material as any).source,
        totalSentences: progress.totalSentences,
      },
      lastSentenceOrder: progress.sentenceOrder,
      totalSentences: progress.totalSentences,
      progressPercent: Math.round(
        (progress.sentenceOrder / progress.totalSentences) * 100,
      ),
    };
  }
}