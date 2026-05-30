import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AsrService } from './asr.service';
import { SentencesService } from '../sentences/sentences.service';
import { PracticeRecordsService } from '../practice-records/practice-records.service';

@Controller('asr')
export class AsrController {
  constructor(
    private readonly asrService: AsrService,
    private readonly sentencesService: SentencesService,
    private readonly recordsService: PracticeRecordsService,
  ) {}

  @Post('evaluate')
  @UseInterceptors(FileInterceptor('audio'))
  async evaluate(
    @UploadedFile() audio: Express.Multer.File,
    @Body('sentenceId') sentenceId: string,
    @Body('language') language = 'en',
    @Body('originalText') originalText?: string,
  ) {
    let sentenceText = originalText;
    if (sentenceId) {
      try {
        const sentence = await this.sentencesService.findById(sentenceId);
        if (sentence) {
          sentenceText = sentence.text;
        }
      } catch {
        // mock ID 不是合法 UUID，PostgreSQL 会抛异常，用前端传的原文即可
      }
    }
    if (!sentenceText) {
      return { error: '句子不存在' };
    }

    const recognizedText = await this.asrService.transcribe(
      audio.buffer,
      audio.originalname || 'recording.mp3',
      language,
    );

    const comparison = this.asrService.compare(sentenceText, recognizedText);

    if (sentenceId) {
      try {
        const record = await this.recordsService.findBySentence(sentenceId);
        if (record) {
          await this.recordsService.updateFeedback(record.id, {
            score: comparison.score,
            errorWords: comparison.missingWords.join(','),
          });
        }
      } catch {
        // 静默：保存评分失败不影响反馈显示
      }
    }

    return {
      recognizedText,
      originalText: sentenceText,
      ...comparison,
    };
  }
}
