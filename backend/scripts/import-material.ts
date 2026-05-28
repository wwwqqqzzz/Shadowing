import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { Material } from '../src/materials/entities/material.entity';
import { Sentence } from '../src/sentences/entities/sentence.entity';
import { PracticeRecord } from '../src/practice-records/entities/practice-record.entity';
import { User } from '../src/users/entities/user.entity';

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

interface Cue {
  startTime: number;
  endTime: number;
  text: string;
}

/** Convert VTT timestamp (HH:MM:SS.mmm) to milliseconds. */
const timeToMs = (t: string): number => {
  const parts = t.trim().split(':');
  if (parts.length === 2) {
    return Math.round((parseInt(parts[0], 10) * 60 + parseFloat(parts[1])) * 1000);
  }
  return Math.round(
    (parseInt(parts[0], 10) * 3600 +
      parseInt(parts[1], 10) * 60 +
      parseFloat(parts[2])) *
      1000,
  );
};

/** Strip VTT-internal tags like <c> and HTML entities. */
const stripVttTags = (text: string): string =>
  text
    .replace(/<\/?c[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const parseVtt = (raw: string): Cue[] => {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const cues: Cue[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '') {
      i++;
      break;
    }
    if (
      i < 15 &&
      (line.startsWith('WEBVTT') ||
        line.startsWith('Kind:') ||
        line.startsWith('Language:'))
    ) {
      i++;
      continue;
    }
    break;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '' || /^\d+$/.test(line)) {
      i++;
      continue;
    }

    if (line.includes('-->')) {
      const parts = line.split(/[ \t]+-->[ \t]+/);
      if (parts.length !== 2) {
        i++;
        continue;
      }

      const startTime = timeToMs(parts[0]);
      const endTime = timeToMs(parts[1].split(/[ \t]+/)[0]);

      i++;
      const textLines: string[] = [];
      while (i < lines.length) {
        const tl = lines[i].trim();
        if (tl === '') break;
        if (/^\d+$/.test(tl)) {
          i++;
          continue;
        }
        const clean = tl.replace(/<\d+:\d+:\d+\.\d+>/g, '').trim();
        if (clean) textLines.push(clean);
        i++;
      }

      const rawText = textLines.join(' ').trim();
      if (rawText) {
        cues.push({ startTime, endTime, text: stripVttTags(rawText) });
      }
    } else {
      i++;
    }
  }

  return cues;
};

const shouldDrop = (cue: Cue): boolean => {
  if (cue.startTime < 5000) return true;
  if (/translator:|reviewer:/i.test(cue.text)) return true;
  if (/[[\]]/.test(cue.text) && !/[a-zA-Z]{3,}/.test(cue.text)) return true;
  return false;
};

const mergeConsecutive = (cues: Cue[]): Cue[] => {
  if (cues.length === 0) return [];
  const result: Cue[] = [{ ...cues[0] }];

  for (let i = 1; i < cues.length; i++) {
    const prev = result[result.length - 1];
    const curr = cues[i];
    if (Math.abs(prev.endTime - curr.startTime) <= 50) {
      prev.endTime = curr.endTime;
      prev.text = (prev.text + ' ' + curr.text).replace(/\s+/g, ' ').trim();
    } else {
      result.push({ ...curr });
    }
  }
  return result;
};

const wordCount = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;

const absorbShort = (cues: Cue[]): Cue[] => {
  if (cues.length <= 1) return cues;
  const result: Cue[] = [];

  for (let i = 0; i < cues.length; i++) {
    if (i < cues.length - 1 && wordCount(cues[i].text) < 4) {
      cues[i + 1].text = (cues[i].text + ' ' + cues[i + 1].text)
        .replace(/\s+/g, ' ')
        .trim();
      cues[i + 1].startTime = cues[i].startTime;
    } else {
      result.push({ ...cues[i] });
    }
  }
  return result;
};

const msToDisplay = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
};

async function main() {
  console.log('Reading VTT...');
  const raw = readFileSync(resolve(vttPath!), 'utf-8');
  const rawCues = parseVtt(raw);
  console.log(`  Raw cues: ${rawCues.length}`);

  const filtered = rawCues.filter((c) => !shouldDrop(c));
  console.log(`  After filter: ${filtered.length}`);

  const merged = mergeConsecutive(filtered);
  console.log(`  After merge: ${merged.length}`);

  const sentences = absorbShort(merged);
  console.log(`  After short-absorb: ${sentences.length}`);

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

    const durationMs = sentences[sentences.length - 1].endTime;
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
