export interface ParsedCue {
  startTime: number;
  endTime: number;
  text: string;
}

export interface VttParseResult {
  sentences: ParsedCue[];
  durationMs: number;
}

/** Convert VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) to milliseconds. */
function timeToMs(t: string): number {
  const parts = t.trim().split(':');
  if (parts.length === 2) {
    return Math.round(
      (parseInt(parts[0], 10) * 60 + parseFloat(parts[1])) * 1000,
    );
  }
  return Math.round(
    (parseInt(parts[0], 10) * 3600 +
      parseInt(parts[1], 10) * 60 +
      parseFloat(parts[2])) *
      1000,
  );
}

/** Strip VTT-internal tags like <c> and HTML entities. */
function stripVttTags(text: string): string {
  return text
    .replace(/<\/?c[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldDrop(cue: ParsedCue): boolean {
  if (cue.startTime < 5000) return true;
  if (/translator:|reviewer:/i.test(cue.text)) return true;
  if (/\[.*\]/.test(cue.text) && !/[a-zA-Z]{3,}/.test(cue.text)) return true;
  return false;
}

function mergeConsecutive(cues: ParsedCue[]): ParsedCue[] {
  if (cues.length === 0) return [];
  const result: ParsedCue[] = [{ ...cues[0] }];

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
}

function absorbShort(cues: ParsedCue[]): ParsedCue[] {
  if (cues.length <= 1) return cues;
  const result: ParsedCue[] = [];
  const mutableCues = cues.map((c) => ({ ...c }));

  for (let i = 0; i < mutableCues.length; i++) {
    if (
      i < mutableCues.length - 1 &&
      mutableCues[i].text.split(/\s+/).filter(Boolean).length < 4
    ) {
      mutableCues[i + 1].text = (
        mutableCues[i].text +
        ' ' +
        mutableCues[i + 1].text
      )
        .replace(/\s+/g, ' ')
        .trim();
      mutableCues[i + 1].startTime = mutableCues[i].startTime;
    } else {
      result.push({ ...mutableCues[i] });
    }
  }
  return result;
}

export function parseVtt(vttContent: string): VttParseResult {
  const normalized = vttContent
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let i = 0;
  // Skip WEBVTT header block
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

  const rawCues: ParsedCue[] = [];

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
        rawCues.push({ startTime, endTime, text: stripVttTags(rawText) });
      }
    } else {
      i++;
    }
  }

  const filtered = rawCues.filter((c) => !shouldDrop(c));
  const merged = mergeConsecutive(filtered);
  const sentences = absorbShort(merged);

  const durationMs =
    sentences.length > 0 ? sentences[sentences.length - 1].endTime : 0;

  return { sentences, durationMs };
}