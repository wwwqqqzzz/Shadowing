import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Sentence } from '../../sentences/entities/sentence.entity';

@Entity()
export class PracticeRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.practiceRecords)
  user: User;

  @ManyToOne(() => Sentence, (sentence) => sentence.practiceRecords)
  sentence: Sentence;

  @Column({ nullable: true })
  audioUrl: string;

  @Column({ nullable: true, type: 'float' })
  score: number;

  @Column({ nullable: true })
  errorWords: string;

  @Column({ default: 0 })
  durationMs: number;

  @CreateDateColumn()
  createdAt: Date;
}
