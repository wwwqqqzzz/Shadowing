import { Module } from '@nestjs/common';
import { PronounceController } from './pronounce.controller';
import { PronounceService } from './pronounce.service';

@Module({
  controllers: [PronounceController],
  providers: [PronounceService],
})
export class PronounceModule {}