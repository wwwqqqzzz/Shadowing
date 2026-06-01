import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MaterialsModule } from './materials/materials.module';
import { SentencesModule } from './sentences/sentences.module';
import { PracticeRecordsModule } from './practice-records/practice-records.module';
import { AsrModule } from './asr/asr.module';
import { AppConfigModule } from './app-config/app-config.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.user'),
        password: config.get('database.pass'),
        database: config.get('database.name'),
        autoLoadEntities: true,
        synchronize: true,
        logging: true,
      }),
    }),
    AuthModule,
    UsersModule,
    MaterialsModule,
    SentencesModule,
    PracticeRecordsModule,
    AsrModule,
    AppConfigModule,
    FavoritesModule,
    ProgressModule,
  ],
})
export class AppModule {}
