import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class AppConfig {
  @PrimaryColumn()
  key: string;

  @Column()
  value: string;
}