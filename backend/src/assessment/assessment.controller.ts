import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AssessmentService } from './assessment.service';

@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get('sentences')
  async getSentences() {
    return this.assessmentService.getSentences();
  }

  @Post('submit')
  @UseGuards(AuthGuard('jwt'))
  async submit(
    @Req() req,
    @Body()
    body: {
      selfReportedLevel: string;
      results: Array<{ sentenceId: string; score: number; recognizedText: string }>;
      skipped: boolean;
    },
  ) {
    return this.assessmentService.submit(
      req.user.id,
      body.selfReportedLevel,
      body.results || [],
      body.skipped ?? false,
    );
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req) {
    return this.assessmentService.getProfile(req.user.id);
  }

  @Get('admin/stats')
  async getStats() {
    return this.assessmentService.getStats();
  }
}