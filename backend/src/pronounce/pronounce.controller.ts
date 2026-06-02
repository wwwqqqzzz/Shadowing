import { Controller, Get, Param } from '@nestjs/common';
import { PronounceService } from './pronounce.service';

@Controller('pronounce')
export class PronounceController {
  constructor(private readonly pronounceService: PronounceService) {}

  @Get(':word')
  async getPronunciation(@Param('word') word: string) {
    return this.pronounceService.getPronunciation(word);
  }
}