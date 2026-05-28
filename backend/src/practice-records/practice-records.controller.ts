import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PracticeRecordsService } from './practice-records.service';

@Controller('practice-records')
export class PracticeRecordsController {
  constructor(private readonly recordsService: PracticeRecordsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(
    @Body() body: { sentenceId: string; durationMs: number },
    @Req() req,
  ) {
    return this.recordsService.create({
      sentenceId: body.sentenceId,
      userId: req.user.id,
      durationMs: body.durationMs || 0,
    });
  }

  @Get('my/stats')
  @UseGuards(AuthGuard('jwt'))
  async getMyStats(@Req() req) {
    return this.recordsService.getMyStats(req.user.id);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  async getMyRecords(
    @Req() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.recordsService.findByUser(
      req.user.id,
      Math.min(parseInt(limit || '20', 10), 100),
      parseInt(offset || '0', 10),
    );
  }
}
