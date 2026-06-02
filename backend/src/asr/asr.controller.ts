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
        // mock ID is not a valid UUID, PostgreSQL throws, fallback to frontend text
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

    const algorithmicResult = this.asrService.compare(sentenceText, recognizedText);

    let finalResult = algorithmicResult;
    let llmUsed = false;

    // Use LLM for ambiguous scores (40-80) where word-level nuance matters
    if (algorithmicResult.score >= 40 && algorithmicResult.score <= 80) {
      const llmResult = await this.asrService.evaluateWithLLM(
        sentenceText,
        recognizedText,
        algorithmicResult,
      );
      if (llmResult) {
        finalResult = {
          ...algorithmicResult,
          wordResults: llmResult.wordResults,
          score: llmResult.score,
        };
        llmUsed = true;
      }
    }

    if (sentenceId) {
      try {
        const record = await this.recordsService.findBySentence(sentenceId);
        if (record) {
          await this.recordsService.updateFeedback(record.id, {
            score: finalResult.score,
            errorWords: finalResult.missingWords.join(','),
          });
        }
      } catch {
        // silent: feedback save failure does not block response
      }
    }

    return {
      ...finalResult,
      llmUsed,
    };
  }
}