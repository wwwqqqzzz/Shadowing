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
  if (/translator:|reviewer:/i.test(cue.text)) return true;
  if (/^\([^)]*\)$/.test(cue.text)) return true;
  if (/^this is \d+ minute english/i.test(cue.text)) return true;
  if (/^hello\.?\s*this is/i.test(cue.text)) return true;
  if (/^greetings?\s+(followers?|everyone|everybody|ladies|gentlemen)/i.test(cue.text)) return true;
  if (/^and settle in[.!]?$/i.test(cue.text)) return true;
  if (/^(hello\.?\s*)?i'm (neil|sam|rob|catherine)\.?\s*(and i'm (neil|sam|rob|catherine)\.?\s*)?$/i.test(cue.text)) return true;
  return false;
}

const MAX_SENTENCE_WORDS = 25;
const MIN_SENTENCE_WORDS = 4;

function endsWithSentenceBoundary(text: string): boolean {
  return /[.!?]["')\]]*$/.test(text.trim());
}

/**
 * Merge VTT cues into proper sentences based on punctuation boundaries.
 * VTT cues are split by screen display lines, not by grammar.
 * We merge forward until we hit a sentence-ending punctuation mark,
 * then start a new sentence.
 */
function mergeBySentence(cues: ParsedCue[]): ParsedCue[] {
  if (cues.length === 0) return [];

  const sentences: ParsedCue[] = [];
  let current: ParsedCue = { ...cues[0] };

  for (let i = 1; i < cues.length; i++) {
    const cue = cues[i];
    const currentWords = current.text.split(/\s+/).filter(Boolean).length;
    const nextWords = cue.text.split(/\s+/).filter(Boolean).length;

    if (endsWithSentenceBoundary(current.text) && currentWords >= MIN_SENTENCE_WORDS) {
      sentences.push(current);
      current = { ...cue };
    } else if (currentWords + nextWords > MAX_SENTENCE_WORDS) {
      sentences.push(current);
      current = { ...cue };
    } else {
      current.endTime = cue.endTime;
      current.text = (current.text + ' ' + cue.text)
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  sentences.push(current);
  return sentences;
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

  const sentences = mergeBySentence(rawCues).filter((c) => !shouldDrop(c));

  const durationMs =
    sentences.length > 0 ? sentences[sentences.length - 1].endTime : 0;

  return { sentences, durationMs };
}