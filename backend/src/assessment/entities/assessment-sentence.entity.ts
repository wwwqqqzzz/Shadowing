import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class AssessmentSentence {
  @PrimaryColumn()
  id: string; // 'a001' ~ 'a005'

  @Column()
  level: string; // beginner / elementary / intermediate / advanced / fluent

  @Column('text')
  text: string;

  @Column()
  audioUrl: string; // '/assessment/audio/a001.mp3'

  @Column()
  order: number; // 1-5

  @CreateDateColumn()
  createdAt: Date;
}