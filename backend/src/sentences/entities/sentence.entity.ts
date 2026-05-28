import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Material } from '../../materials/entities/material.entity';
import { PracticeRecord } from '../../practice-records/entities/practice-record.entity';

@Entity()
export class Sentence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Material, (material) => material.sentences)
  material: Material;

  @Column()
  order: number;

  @Column()
  startTime: number;

  @Column()
  endTime: number;

  @Column('text')
  text: string;

  @Column({ nullable: true })
  translation: string;

  @Column({ nullable: true })
  audioUrl: string;

  @OneToMany(() => PracticeRecord, (record) => record.sentence)
  practiceRecords: PracticeRecord[];
}
