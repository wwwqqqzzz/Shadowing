import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialsController } from './materials.controller';
import { AdminMaterialsController } from './admin-materials.controller';
import { MaterialsService } from './materials.service';
import { Material } from './entities/material.entity';
import { Sentence } from '../sentences/entities/sentence.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Material, Sentence])],
  controllers: [MaterialsController, AdminMaterialsController],
  providers: [MaterialsService],
})
export class MaterialsModule {}