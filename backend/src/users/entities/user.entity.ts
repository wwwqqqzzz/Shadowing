import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { PracticeRecord } from '../../practice-records/entities/practice-record.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  openid: string;

  @Column({ nullable: true })
  nickname: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: 'en' })
  preferredLanguage: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => PracticeRecord, (record) => record.user)
  practiceRecords: PracticeRecord[];
}
