import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from './entities/app-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppConfig])],
  providers: [],
  exports: [TypeOrmModule],
})
export class AppConfigModule implements OnModuleInit {
  constructor(
    @InjectRepository(AppConfig)
    private readonly configRepo: Repository<AppConfig>,
  ) {}

  async onModuleInit() {
    const existing = await this.configRepo.findOne({
      where: { key: 'mastery_threshold' },
    });
    if (!existing) {
      await this.configRepo.save(
        this.configRepo.create({ key: 'mastery_threshold', value: '80' }),
      );
    }
  }
}