import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(
    @Query('language') language?: string,
    @Query('level') level?: string,
    @Query('status') status?: string,
    @Query('accent') accent?: string,
    @Query('duration') duration?: string,
    @Req() req?: any,
  ) {
    const userId = req.user?.id || null;
    return this.materialsService.findAll({ language, level, status, accent, duration }, userId);
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