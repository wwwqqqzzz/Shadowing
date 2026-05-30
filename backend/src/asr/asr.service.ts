import { Injectable } from '@nestjs/common';
const FormData = require('form-data');
const fetch = require('node-fetch');

@Injectable()
export class AsrService {
  private readonly ASR_URL = 'http://localhost:8000/transcribe';

  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    language = 'en',
  ): Promise<string> {
    const form = new FormData();
    form.append('audio', audioBuffer, { filename, contentType: 'audio/mpeg' });
    form.append('language', language);

    const res = await fetch(this.ASR_URL, { method: 'POST', body: form as any });
    const data = await res.json();
    return data.text;
  }

  compare(original: string, recognized: string): {
    score: number;
    missingWords: string[];
    extraWords: string[];
    errorCount: number;
  } {
    const clean = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const origWords = clean(original);
    const recogWords = clean(recognized);

    const recogSet = new Set(recogWords);
    const missingWords = origWords.filter((w) => !recogSet.has(w));

    const origSet = new Set(origWords);
    const extraWords = recogWords.filter((w) => !origSet.has(w));

    const correctCount = origWords.length - missingWords.length;
    const score = Math.max(
      0,
      Math.round((correctCount / origWords.length) * 100),
    );

    return {
      score,
      missingWords: [...new Set(missingWords)],
      extraWords: [...new Set(extraWords)],
      errorCount: missingWords.length,
    };
  }
}
