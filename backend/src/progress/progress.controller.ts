import { Controller, Post, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async save(
    @Req() req,
    @Body() body: { materialId: string; sentenceOrder: number; totalSentences: number },
  ) {
    return this.progressService.saveProgress(
      req.user.id,
      body.materialId,
      body.sentenceOrder,
      body.totalSentences,
    );
  }

  @Get(':materialId')
  @UseGuards(AuthGuard('jwt'))
  async get(@Req() req, @Param('materialId') materialId: string) {
    return this.progressService.getProgress(req.user.id, materialId);
  }
}