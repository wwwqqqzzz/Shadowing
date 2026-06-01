import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Material } from '../../materials/entities/material.entity';

@Entity()
@Index(['user', 'material'], { unique: true })
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @ManyToOne(() => Material, (material) => material.id)
  material: Material;

  @CreateDateColumn()
  createdAt: Date;
}