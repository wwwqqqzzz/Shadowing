import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PracticeRecordsController } from './practice-records.controller';
import { PracticeRecordsService } from './practice-records.service';
import { PracticeRecord } from './entities/practice-record.entity';
import { AppConfig } from '../app-config/entities/app-config.entity';
import { Sentence } from '../sentences/entities/sentence.entity';
import { Progress } from '../progress/entities/progress.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PracticeRecord, AppConfig, Sentence, Progress])],
  controllers: [PracticeRecordsController],
  providers: [PracticeRecordsService],
  exports: [PracticeRecordsService],
})
export class PracticeRecordsModule {}