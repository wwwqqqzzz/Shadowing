import {
  Controller,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MaterialsService } from './materials.service';

@Controller('admin/materials')
export class AdminMaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post('import')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'audioFile', maxCount: 1 },
      { name: 'vttFile', maxCount: 1 },
    ]),
  )
  async importMaterial(
    @Body('title') title: string,
    @Body('source') source: string,
    @Body('level') level: string,
    @UploadedFiles()
    files: {
      audioFile?: Express.Multer.File[];
      vttFile?: Express.Multer.File[];
    },
  ) {
    const vttContent = files.vttFile?.[0]?.buffer?.toString('utf-8') ?? '';
    const audioFilename = files.audioFile?.[0]?.originalname ?? '';

    return this.materialsService.importFromVtt({
      vttContent,
      audioFilename,
      title,
      source: source || 'Unknown',
      level: level || 'intermediate',
    });
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.materialsService.updateStatus(id, status);
  }

  @Delete(':id')
  async deleteMaterial(@Param('id') id: string) {
    return this.materialsService.deleteMaterial(id);
  }

  @Patch('sentences/:id')
  async updateSentence(
    @Param('id') id: string,
    @Body() data: { order?: number; startTime?: number; endTime?: number; text?: string; audioUrl?: string },
  ) {
    return this.materialsService.updateSentence(id, data);
  }
}
