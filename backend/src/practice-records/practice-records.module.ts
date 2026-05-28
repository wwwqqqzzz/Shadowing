import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PracticeRecordsController } from './practice-records.controller';
import { PracticeRecordsService } from './practice-records.service';
import { PracticeRecord } from './entities/practice-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PracticeRecord])],
  controllers: [PracticeRecordsController],
  providers: [PracticeRecordsService],
})
export class PracticeRecordsModule {}
