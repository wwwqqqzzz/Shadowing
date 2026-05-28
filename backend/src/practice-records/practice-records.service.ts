import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeRecord } from './entities/practice-record.entity';

@Injectable()
export class PracticeRecordsService {
  constructor(
    @InjectRepository(PracticeRecord)
    private readonly recordRepo: Repository<PracticeRecord>,
  ) {}

  async create(data: { sentenceId: string; userId: string; durationMs: number }): Promise<PracticeRecord> {
    const record = this.recordRepo.create({
      sentence: { id: data.sentenceId } as any,
      user: { id: data.userId } as any,
      durationMs: data.durationMs,
    });
    return this.recordRepo.save(record);
  }

  async findByUser(userId: string, limit = 20, offset = 0): Promise<PracticeRecord[]> {
    return this.recordRepo.find({
      where: { user: { id: userId } },
      relations: { sentence: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getMyStats(userId: string) {
    const totalSentences = await this.recordRepo.count({
      where: { user: { id: userId } },
    });

    const sumResult = await this.recordRepo
      .createQueryBuilder('record')
      .select('COALESCE(SUM(record.durationMs), 0)', 'total')
      .where('record.userId = :userId', { userId })
      .getRawOne();
    const totalDurationMs = parseInt(sumResult?.total || '0', 10);

    const recentRecords = await this.recordRepo.find({
      where: { user: { id: userId } },
      relations: { sentence: { material: true } },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return { totalSentences, totalDurationMs, recentRecords };
  }
}
