import { Controller, Get, Param, Query } from '@nestjs/common';
import { MaterialsService } from './materials.service';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  async findAll(
    @Query('language') language?: string,
    @Query('level') level?: string,
    @Query('status') status?: string,
  ) {
    return this.materialsService.findAll({ language, level, status });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.materialsService.findById(id);
  }

  @Get(':id/sentences')
  async findSentences(@Param('id') id: string) {
    return this.materialsService.findSentencesByMaterialId(id);
  }
}