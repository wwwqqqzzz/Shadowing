import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SentencesService } from './sentences.service';
import { Sentence } from './entities/sentence.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sentence])],
  providers: [SentencesService],
  exports: [SentencesService],
})
export class SentencesModule {}
