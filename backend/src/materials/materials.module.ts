import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialsController } from './materials.controller';
import { AdminMaterialsController } from './admin-materials.controller';
import { MaterialsService } from './materials.service';
import { Material } from './entities/material.entity';
import { Sentence } from '../sentences/entities/sentence.entity';
import { ProgressModule } from '../progress/progress.module';
import { AlignmentModule } from '../alignment/alignment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Material, Sentence]),
    ProgressModule,
    AlignmentModule,
  ],
  controllers: [MaterialsController, AdminMaterialsController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
