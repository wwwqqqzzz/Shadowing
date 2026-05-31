import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { Material } from '../src/materials/entities/material.entity';
import { Sentence } from '../src/sentences/entities/sentence.entity';
import { PracticeRecord } from '../src/practice-records/entities/practice-record.entity';
import { User } from '../src/users/entities/user.entity';
import { parseVtt } from '../src/materials/vtt-parser';

const args = process.argv.slice(2);
const getArg = (flag: string): string | null => {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
};

const vttPath = getArg('--vtt');
const audioPath = getArg('--audio');
const title = getArg('--title');
const source = getArg('--source') || 'Unknown';
const level = getArg('--level') || 'intermediate';

if (!vttPath || !audioPath || !title) {
  console.error(
    'Usage: npx ts-node scripts/import-material.ts' +
      ' --vtt <file> --audio <file> --title <title>',
  );
  console.error(
    'Optional: --source <source> --level <beginner|intermediate|advanced>',
  );
  process.exit(1);
}

const msToDisplay = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
};

async function main() {
  console.log('Reading VTT...');
  const raw = readFileSync(resolve(vttPath!), 'utf-8');
  const { sentences, durationMs } = parseVtt(raw);
  console.log(`  Sentences: ${sentences.length}`);
  console.log(`  Duration: ${msToDisplay(durationMs)}`);

  if (sentences.length === 0) {
    console.error('No valid sentences after processing.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'wang',
    password: process.env.DATABASE_PASS || '',
    database: process.env.DATABASE_NAME || 'shadowing_dev',
    entities: [Material, Sentence, PracticeRecord, User],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('DB connected.');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const materialRepo = queryRunner.manager.getRepository(Material);
    const sentenceRepo = queryRunner.manager.getRepository(Sentence);

    const audioFileName = audioPath!.split(/[\\/]/).pop() || audioPath!;

    const material = new Material();
    material.title = title!;
    material.language = 'en';
    material.level = level;
    material.audioUrl = audioFileName;
    material.durationMs = durationMs;
    material.status = 'published';
    material.source = source;
    await materialRepo.save(material);

    const sentenceEntities = sentences.map((s, i) => {
      const sentence = new Sentence();
      sentence.material = material;
      sentence.order = i + 1;
      sentence.startTime = s.startTime;
      sentence.endTime = s.endTime;
      sentence.text = s.text;
      return sentence;
    });
    await sentenceRepo.save(sentenceEntities);

    await queryRunner.commitTransaction();

    console.log('');
    console.log('Import complete');
    console.log(`  Material ID: ${material.id}`);
    console.log(`  Sentences: ${sentenceEntities.length}`);
    console.log(`  Duration: ${msToDisplay(durationMs)}`);
    console.log('');
    console.log('Preview (first 5):');
    sentenceEntities.slice(0, 5).forEach((s) => {
      const t = s.text.length > 60 ? s.text.slice(0, 60) + '...' : s.text;
      console.log(`  ${s.order}. [${msToDisplay(s.startTime)}] ${t}`);
    });
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
