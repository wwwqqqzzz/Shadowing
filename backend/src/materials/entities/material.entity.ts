import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Sentence } from '../../sentences/entities/sentence.entity';

@Entity()
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ default: 'en' })
  language: string;

  @Column()
  level: string;

  @Column({ nullable: true })
  coverUrl: string;

  @Column()
  audioUrl: string;

  @Column({ default: 0 })
  durationMs: number;

  @Column({ default: 'draft' })
  status: string;

  @Column({ nullable: true })
  source: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Sentence, (sentence) => sentence.material, { cascade: true })
  sentences: Sentence[];
}
