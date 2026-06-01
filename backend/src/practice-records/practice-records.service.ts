import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeRecord } from './entities/practice-record.entity';
import { AppConfig } from '../app-config/entities/app-config.entity';
import { Sentence } from '../sentences/entities/sentence.entity';
import { Progress } from '../progress/entities/progress.entity';

@Injectable()
export class PracticeRecordsService {
  constructor(
    @InjectRepository(PracticeRecord)
    private readonly recordRepo: Repository<PracticeRecord>,
    @InjectRepository(AppConfig)
    private readonly configRepo: Repository<AppConfig>,
    @InjectRepository(Sentence)
    private readonly sentenceRepo: Repository<Sentence>,
    @InjectRepository(Progress)
    private readonly progressRepo: Repository<Progress>,
  ) {}

  async create(data: { sentenceId: string; userId: string; durationMs: number }): Promise<PracticeRecord> {
    const record = this.recordRepo.create({
      sentence: { id: data.sentenceId } as any,
      user: { id: data.userId } as any,
      durationMs: data.durationMs,
    });
    return this.recordRepo.save(record);
  }

  async getLastProgress(userId: string) {
    // prefer progress table (more accurate, saved on exit)
    const latestProgress = await this.progressRepo.findOne({
      where: { user: { id: userId } },
      relations: { material: true },
      order: { updatedAt: 'DESC' },
    });

    if (latestProgress) {
      const mat = latestProgress.material as any;
      return {
        material: {
          id: mat.id,
          title: mat.title,
          audioUrl: mat.audioUrl,
          level: mat.level,
          accent: mat.accent || 'american',
          source: mat.source,
          totalSentences: latestProgress.totalSentences,
        },
        lastSentenceOrder: latestProgress.sentenceOrder,
        totalSentences: latestProgress.totalSentences,
        progressPercent: Math.round(
          (latestProgress.sentenceOrder / latestProgress.totalSentences) * 100,
        ),
      };
    }

    // fallback to practice_record (legacy)
    const record = await this.recordRepo.findOne({
      where: { user: { id: userId } },
      relations: { sentence: { material: true } },
      order: { createdAt: 'DESC' },
    });

    if (!record?.sentence?.material) return null;

    const material = record.sentence.material;
    const totalSentences = await this.sentenceRepo.count({
      where: { material: { id: material.id } },
    });

    return {
      material: {
        id: material.id,
        title: material.title,
        audioUrl: material.audioUrl,
        level: material.level,
        accent: material.accent || 'american',
        source: material.source,
        totalSentences,
      },
      lastSentenceOrder: record.sentence.order,
      totalSentences,
      progressPercent: Math.round((record.sentence.order / totalSentences) * 100),
    };
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

  async findBySentence(sentenceId: string): Promise<PracticeRecord | null> {
    return this.recordRepo.findOne({
      where: { sentence: { id: sentenceId } },
      order: { createdAt: 'DESC' },
    });
  }

  async updateFeedback(
    id: string,
    data: { score: number; errorWords: string },
  ): Promise<void> {
    await this.recordRepo.update(id, {
      score: data.score,
      errorWords: data.errorWords,
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

    const streak = await this.getStreakStats(userId);

    return {
      totalSentences,
      totalDurationMs,
      recentRecords,
      currentStreak: streak.currentStreak,
      todayDone: streak.todayDone,
    };
  }

  private async getMasteryThreshold(): Promise<number> {
    const config = await this.configRepo.findOne({
      where: { key: 'mastery_threshold' },
    });
    return config ? parseInt(config.value, 10) : 80;
  }

  async getWrongSentences(userId: string) {
    const threshold = await this.getMasteryThreshold();

    // Get all distinct sentenceIds with scored records for this user
    const sentenceIdsResult = await this.recordRepo
      .createQueryBuilder('record')
      .select('DISTINCT record.sentenceId', 'sentenceId')
      .where('record.userId = :userId', { userId })
      .andWhere('record.score IS NOT NULL')
      .getRawMany();

    const wrongItems: any[] = [];

    for (const row of sentenceIdsResult) {
      const sentenceId = row.sentenceId;

      // Get latest 2 records for this sentence
      const latestRecords = await this.recordRepo.find({
        where: { user: { id: userId }, sentence: { id: sentenceId } },
        order: { createdAt: 'DESC' },
        take: 2,
      });

      if (latestRecords.length === 0) continue;

      const latestRecord = latestRecords[0];
      const latestScore = latestRecord.score;

      if (latestScore >= threshold && latestRecords.length >= 2 && latestRecords[1].score >= threshold) continue;
      if (latestScore >= threshold && latestRecords.length < 2) continue;

      // 1 more pass needed: latest ≥80 but previous <80
      const oneMorePass = latestScore >= threshold && latestRecords.length >= 2 && latestRecords[1].score < threshold;

      const daysSinceLastReview = Math.min(
        Math.floor((new Date().getTime() - latestRecord.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        30,
      );

      const errorCountResult = await this.recordRepo
        .createQueryBuilder('record')
        .select('COUNT(*)', 'cnt')
        .where('record.userId = :userId', { userId })
        .andWhere('record.sentenceId = :sentenceId', { sentenceId })
        .andWhere('record.score IS NOT NULL')
        .andWhere('record.score < :threshold', { threshold })
        .getRawOne();
      const actualErrorCount = parseInt(errorCountResult?.cnt || '0', 10);

      const priority =
        (100 - latestScore) * 0.6 + daysSinceLastReview * 0.2 + actualErrorCount * 0.2;

      wrongItems.push({
        sentenceId,
        latestScore,
        oneMorePass,
        errorCount: actualErrorCount,
        daysSinceLastReview,
        priority,
        lastPracticeAt: latestRecord.createdAt,
      });
    }

    // Sort by priority DESC
    wrongItems.sort((a, b) => b.priority - a.priority);

    // Limit to 100
    const limited = wrongItems.slice(0, 100);

    // Enrich with sentence details
    const items = await Promise.all(
      limited.map(async (item) => {
        const record = await this.recordRepo.findOne({
          where: { user: { id: userId }, sentence: { id: item.sentenceId } },
          relations: { sentence: { material: true } },
          order: { createdAt: 'DESC' },
        });

        const sentence = record?.sentence;
        const material = sentence?.material;

        return {
          sentenceId: item.sentenceId,
          sentence: sentence
            ? {
                text: sentence.text,
                translation: sentence.translation,
                startTime: sentence.startTime,
                endTime: sentence.endTime,
                material: material
                  ? { id: material.id, title: material.title, audioUrl: material.audioUrl }
                  : null,
              }
            : null,
          latestScore: item.latestScore,
          errorCount: item.errorCount,
          daysSinceLastReview: item.daysSinceLastReview,
          priority: Math.round(item.priority * 100) / 100,
          lastPracticeAt: item.lastPracticeAt,
        };
      }),
    );

    return { total: wrongItems.length, items };
  }

  async getStreakStats(userId: string) {
    // Get all distinct practice dates for this user (YYYY-MM-DD)
    const rawDates = await this.recordRepo
      .createQueryBuilder('record')
      .select("DISTINCT TO_CHAR(record.\"createdAt\", 'YYYY-MM-DD')", 'date')
      .where('record.userId = :userId', { userId })
      .getRawMany();

    const dates = rawDates
      .map((r) => r.date)
      .sort()
      .reverse(); // descending

    const today = new Date().toISOString().split('T')[0];
    const todayDone = dates.length > 0 && dates[0] === today;

    // Calculate current streak: start from today or yesterday
    let currentStreak = 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const dateSet = new Set(dates);
    let cursor = dateSet.has(today) ? today : dateSet.has(yesterdayStr) ? yesterdayStr : null;

    if (cursor) {
      currentStreak = 0;
      let d = cursor;
      while (dateSet.has(d)) {
        currentStreak++;
        const prev = new Date(d);
        prev.setDate(prev.getDate() - 1);
        d = prev.toISOString().split('T')[0];
      }
    }

    // Calculate longest streak: iterate all dates
    let longestStreak = 0;
    const sortedAsc = [...dates].sort();
    if (sortedAsc.length > 0) {
      let streak = 1;
      longestStreak = 1;
      for (let i = 1; i < sortedAsc.length; i++) {
        const prev = new Date(sortedAsc[i - 1]);
        prev.setDate(prev.getDate() + 1);
        const expectedNext = prev.toISOString().split('T')[0];
        if (sortedAsc[i] === expectedNext) {
          streak++;
          if (streak > longestStreak) longestStreak = streak;
        } else {
          streak = 1;
        }
      }
    }

    // Calendar dates: last 90 days only
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];
    const calendarDates = dates.filter((d) => d >= ninetyDaysAgoStr);

    return {
      currentStreak,
      longestStreak,
      totalDays: dates.length,
      todayDone,
      calendarDates,
    };
  }

  async getWeeklyStats(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyRows = await this.recordRepo
      .createQueryBuilder('record')
      .select("TO_CHAR(record.\"createdAt\", 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(AVG(record.score), 0)', 'avgScore')
      .where('record.userId = :userId', { userId })
      .andWhere('record."createdAt" >= :since', { since: sevenDaysAgo })
      .groupBy("TO_CHAR(record.\"createdAt\", 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    const dailyMap = new Map(dailyRows.map(r => [r.date, { count: parseInt(r.count, 10), avgScore: Math.round(parseFloat(r.avgScore)) }]));
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const weeklyData: { date: string; dayLabel: string; count: number; avgScore: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = dailyMap.get(dateStr) || { count: 0, avgScore: 0 };
      weeklyData.push({
        date: dateStr,
        dayLabel: days[d.getDay()],
        count: entry.count,
        avgScore: entry.avgScore,
      });
    }

    const scoreResult = await this.recordRepo
      .createQueryBuilder('record')
      .select('COALESCE(AVG(record.score), 0)', 'avgScore')
      .where('record.userId = :userId', { userId })
      .andWhere('record.score IS NOT NULL')
      .getRawOne();
    const overallAvgScore = Math.round(parseFloat(scoreResult?.avgScore || '0'));

    const topMaterialRow = await this.recordRepo
      .createQueryBuilder('record')
      .select('material.title', 'title')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('record.sentence', 'sentence')
      .innerJoin('sentence.material', 'material')
      .where('record.userId = :userId', { userId })
      .groupBy('material.title')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne();

    return {
      weeklyData,
      overallAvgScore,
      topMaterial: topMaterialRow
        ? { title: topMaterialRow.title, count: parseInt(topMaterialRow.count, 10) }
        : null,
    };
  }

  async getWrongCount(userId: string) {
    const threshold = await this.getMasteryThreshold();

    // Get all distinct sentenceIds with scored records
    const sentenceIdsResult = await this.recordRepo
      .createQueryBuilder('record')
      .select('DISTINCT record.sentenceId', 'sentenceId')
      .where('record.userId = :userId', { userId })
      .andWhere('record.score IS NOT NULL')
      .getRawMany();

    let count = 0;
    let lastReviewedAt: Date | null = null;

    for (const row of sentenceIdsResult) {
      const sentenceId = row.sentenceId;

      const latestRecords = await this.recordRepo.find({
        where: { user: { id: userId }, sentence: { id: sentenceId } },
        order: { createdAt: 'DESC' },
        take: 2,
      });

      if (latestRecords.length === 0) continue;

      const latest = latestRecords[0];
      if (latest.score == null) continue;

      const isRemoved = latest.score >= threshold &&
        latestRecords.length >= 2 && latestRecords[1].score >= threshold;
      const isNeverWrong = latest.score >= threshold && latestRecords.length < 2;

      if (!isRemoved && !isNeverWrong) {
        count++;
        if (!lastReviewedAt || latest.createdAt > lastReviewedAt) {
          lastReviewedAt = latest.createdAt;
        }
      }
    }

    return { count, lastReviewedAt };
  }
}