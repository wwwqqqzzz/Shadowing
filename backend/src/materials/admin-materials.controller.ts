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
import { diskStorage } from 'multer';
import { resolve } from 'path';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { MaterialsService } from './materials.service';

/** 从 __dirname 向上找项目根目录（与 main.ts 的逻辑一致） */
function findProjectRoot(): string {
  let dir = resolve(__dirname);
  while (!existsSync(resolve(dir, 'miniprogram'))) {
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

const AUDIO_STORAGE = diskStorage({
  destination: resolve(findProjectRoot(), 'tmp'),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    cb(null, `${ts}-${file.originalname}`);
  },
});

@Controller('admin/materials')
export class AdminMaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post('import')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'audioFile', maxCount: 1 },
        { name: 'vttFile', maxCount: 1 },
      ],
      { storage: AUDIO_STORAGE },
    ),
  )
  async importMaterial(
    @Body('title') title: string,
    @Body('source') source: string,
    @Body('level') level: string,
    @Body('audioOffsetMs') audioOffsetMs: string,
    @UploadedFiles()
    files: {
      audioFile?: Express.Multer.File[];
      vttFile?: Express.Multer.File[];
    },
  ) {
    const vttFile = files.vttFile?.[0];
    const audioFile = files.audioFile?.[0];

    const vttContent = vttFile ? readFileSync(vttFile.path, 'utf-8') : '';
    const audioFilename = audioFile?.filename ?? '';

    if (vttFile) {
      try { unlinkSync(vttFile.path); } catch {}
    }

    return this.materialsService.importFromVtt({
      vttContent,
      audioFilename,
      title,
      source: source || 'Unknown',
      level: level || 'intermediate',
      audioOffsetMs: audioOffsetMs ? parseInt(audioOffsetMs, 10) : 0,
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

  @Patch(':id/offset')
  async updateOffset(
    @Param('id') id: string,
    @Body('audioOffsetMs') audioOffsetMs: number,
  ) {
    return this.materialsService.updateOffset(id, audioOffsetMs);
  }

  @Patch(':id')
  async updateMaterial(
    @Param('id') id: string,
    @Body() body: { accent?: string; level?: string; status?: string },
  ) {
    return this.materialsService.updateMaterial(id, body);
  }
}
