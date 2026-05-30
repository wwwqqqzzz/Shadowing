import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AsrController } from './asr.controller';
import { AsrService } from './asr.service';
import { SentencesModule } from '../sentences/sentences.module';
import { PracticeRecordsModule } from '../practice-records/practice-records.module';

@Module({
  imports: [
    MulterModule.register({}),
    SentencesModule,
    PracticeRecordsModule,
  ],
  controllers: [AsrController],
  providers: [AsrService],
})
export class AsrModule {}
