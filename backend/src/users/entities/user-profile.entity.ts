import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ nullable: true })
  selfReportedLevel: string; // beginner / elementary / intermediate / advanced / fluent

  @Column({ nullable: true })
  assessedLevel: string;

  @Column({ nullable: true, type: 'float' })
  assessmentScore: number | null;

  @Column({ nullable: true })
  hasCompletedAssessment: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  assessmentCompletedAt: Date | null;

  @Column({ default: 'onboarding' })
  onboardingStatus: string; // 'onboarding' | 'completed'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}