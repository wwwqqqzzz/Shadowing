import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlignmentService } from './alignment.service';
import { AlignmentController } from './alignment.controller';
import { Material } from '../materials/entities/material.entity';
import { Sentence } from '../sentences/entities/sentence.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Material, Sentence])],
  controllers: [AlignmentController],
  providers: [AlignmentService],
  exports: [AlignmentService],
})
export class AlignmentModule {}
