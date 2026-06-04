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

  const uploadsAudioPath = resolve(dir, 'backend', 'uploads', 'audio');
  const tmpAudioPath = resolve(dir, 'tmp');
  const mockAudioPath = resolve(dir, 'miniprogram', 'mock', 'audio');
  const assessmentAudioPath = resolve(
    dir,
    'miniprogram',
    'assessment',
    'audio',
  );
  const pronounceAudioPath = resolve(dir, 'backend', 'audio', 'pronounce');
  app.useStaticAssets(uploadsAudioPath, {
    prefix: '/audio/',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
    },
  });
  app.useStaticAssets(tmpAudioPath, {
    prefix: '/audio/',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
    },
  });
  app.useStaticAssets(mockAudioPath, {
    prefix: '/audio/',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
    },
  });
  app.useStaticAssets(assessmentAudioPath, {
    prefix: '/assessment/audio/',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
    },
  });
  app.useStaticAssets(pronounceAudioPath, {
    prefix: '/audio/pronounce/',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/api`);
  console.log(
    `Audio static: ${uploadsAudioPath} + ${tmpAudioPath} + ${mockAudioPath} → /audio/`,
  );
  console.log(`Assessment audio: ${assessmentAudioPath} → /assessment/audio/`);

  const ASR_URL = process.env.ASR_URL || 'http://localhost:8000/health';
  await checkAsrHealth(ASR_URL);
}
bootstrap();

async function checkAsrHealth(url: string) {
  const maxAttempts = 6;
  const intervalMs = 2000;
  for (let i = 1; i <= maxAttempts; i++) {
    const ok = await fetch(url, { signal: AbortSignal.timeout(1500) })
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) {
      console.log(`✓ asr-service reachable at ${url}`);
      return;
    }
    if (i < maxAttempts) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  console.warn(`\n⚠️  asr-service NOT reachable at ${url}`);
  console.warn(`   Practice mode (auto-record) will fail — recordings won't get scores.`);
  console.warn(`   Start it with:  cd asr-service && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000\n`);
}
