import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // 从 __dirname 向上找项目根目录（适配 dev / dist 不同运行目录）
  let dir = resolve(__dirname);
  while (!existsSync(resolve(dir, 'miniprogram'))) {
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  const tmpAudioPath = resolve(dir, 'tmp');
  const mockAudioPath = resolve(dir, 'miniprogram', 'mock', 'audio');
  app.useStaticAssets(tmpAudioPath, { prefix: '/audio/' });
  app.useStaticAssets(mockAudioPath, { prefix: '/audio/' });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/api`);
  console.log(`Audio static: ${tmpAudioPath} + ${mockAudioPath} → /audio/`);
}
bootstrap();
