import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentSentence } from './entities/assessment-sentence.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { User } from '../users/entities/user.entity';
import { Material } from '../materials/entities/material.entity';

const LEVEL_ORDER = ['beginner', 'elementary', 'intermediate', 'advanced', 'fluent'];

@Injectable()
export class AssessmentService {
  constructor(
    @InjectRepository(AssessmentSentence)
    private readonly sentenceRepo: Repository<AssessmentSentence>,
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,
  ) {}

  async getSentences(): Promise<AssessmentSentence[]> {
    return this.sentenceRepo.find({ order: { order: 'ASC' } });
  }

  async submit(
    userId: string,
    selfReportedLevel: string,
    results: Array<{ sentenceId: string; score: number; recognizedText: string }>,
    skipped: boolean,
  ) {
    let assessedLevel = selfReportedLevel;
    let assessmentScore: number | null = null;
    let levelMatch: string = 'accurate';

    if (!skipped && results && results.length > 0) {
      const avgScore =
        results.reduce((sum, r) => sum + r.score, 0) / results.length;
      assessmentScore = Math.round(avgScore * 100) / 100;

      assessedLevel =
        avgScore >= 95
          ? 'fluent'
          : avgScore >= 85
            ? 'advanced'
            : avgScore >= 70
              ? 'intermediate'
              : avgScore >= 50
                ? 'elementary'
                : 'beginner';

      const assessedIdx = LEVEL_ORDER.indexOf(assessedLevel);
      const selfIdx = LEVEL_ORDER.indexOf(selfReportedLevel);
      levelMatch =
        assessedIdx === selfIdx
          ? 'accurate'
          : assessedIdx > selfIdx
            ? 'underestimated'
            : 'overestimated';
    }

    const messages: Record<string, string> = {
      accurate: '你对自己的水平判断很准确！',
      underestimated: '你比自己想的要好！测评结果比你自报的高了一个等级。',
      overestimated: '测评显示你还有很大提升空间，从扎实的基础开始练效果更好。',
    };

    let profile = await this.profileRepo.findOne({
      where: { user: { id: userId } as any },
    });

    if (profile) {
      profile.selfReportedLevel = selfReportedLevel;
      profile.assessedLevel = assessedLevel;
      profile.assessmentScore = assessmentScore;
      profile.hasCompletedAssessment = !skipped;
      profile.assessmentCompletedAt = skipped ? null : new Date();
      profile.onboardingStatus = 'completed';
      await this.profileRepo.save(profile);
    } else {
      const newProfile = this.profileRepo.create({
        user: { id: userId } as any,
        selfReportedLevel,
        assessedLevel,
        assessmentScore,
        hasCompletedAssessment: !skipped,
        assessmentCompletedAt: skipped ? null : new Date(),
        onboardingStatus: 'completed',
      } as any);
      profile = await this.profileRepo.save(newProfile) as any;
    }

    const recommendedMaterials = await this.materialRepo.find({
      where: { level: assessedLevel, status: 'published' },
      order: { createdAt: 'DESC' },
      take: 3,
    });

    const finalMaterials =
      recommendedMaterials.length > 0
        ? recommendedMaterials
        : await this.materialRepo.find({
            where: { status: 'published' },
            order: { createdAt: 'DESC' },
            take: 3,
          });

    return {
      assessedLevel,
      assessmentScore,
      selfReportedLevel,
      levelMatch,
      recommendedMaterials: finalMaterials,
      message: messages[levelMatch] || messages.accurate,
    };
  }

  async getProfile(userId: string) {
    const profile = await this.profileRepo.findOne({
      where: { user: { id: userId } as any },
    });
    if (!profile) {
      return { onboardingStatus: 'onboarding', hasCompletedAssessment: false };
    }
    return profile;
  }

  async getStats() {
    const totalProfiles = await this.profileRepo.count({
      where: { hasCompletedAssessment: true },
    });

    const allProfiles = await this.profileRepo.find({
      where: { hasCompletedAssessment: true },
    });

    const selfReportedDistribution: Record<string, number> = {};
    const assessedDistribution: Record<string, number> = {};
    let accurateCount = 0;
    let underestimatedCount = 0;
    let overestimatedCount = 0;
    let totalScore = 0;

    for (const p of allProfiles) {
      selfReportedDistribution[p.selfReportedLevel] =
        (selfReportedDistribution[p.selfReportedLevel] || 0) + 1;
      assessedDistribution[p.assessedLevel] =
        (assessedDistribution[p.assessedLevel] || 0) + 1;

      const assessedIdx = LEVEL_ORDER.indexOf(p.assessedLevel);
      const selfIdx = LEVEL_ORDER.indexOf(p.selfReportedLevel);
      if (assessedIdx === selfIdx) accurateCount++;
      else if (assessedIdx > selfIdx) underestimatedCount++;
      else overestimatedCount++;

      if (p.assessmentScore) totalScore += p.assessmentScore;
    }

    return {
      totalAssessed: totalProfiles,
      selfReportedDistribution,
      assessedDistribution,
      levelMatchBreakdown: { accurate: accurateCount, underestimated: underestimatedCount, overestimated: overestimatedCount },
      averageScore: totalProfiles > 0 ? Math.round((totalScore / totalProfiles) * 100) / 100 : 0,
    };
  }
}