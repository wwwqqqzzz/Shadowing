import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AlignmentService, AlignmentResult } from './alignment.service';

interface AlignBody {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  async?: boolean;
}

@Controller('admin/materials')
export class AlignmentController {
  constructor(private readonly alignmentService: AlignmentService) {}

  @Post(':id/align')
  @HttpCode(HttpStatus.ACCEPTED)
  async align(
    @Param('id') id: string,
    @Body() body: AlignBody = {},
  ): Promise<AlignmentResult> {
    return this.alignmentService.alignMaterial(id, {
      model: body.model ?? 'base',
      async: body.async ?? true,
    });
  }
}
