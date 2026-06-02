import { Injectable } from '@nestjs/common';

export interface PronounceResult {
  word: string;
  ipa: string | null;
  ipaAlt: string | null;
  audioUrl: string | null;
}

// In-memory cache — pronunciation data is immutable
const cache = new Map<string, PronounceResult>();

@Injectable()
export class PronounceService {
  async getPronunciation(word: string): Promise<PronounceResult> {
    const normalized = word.toLowerCase().replace(/[^a-z'-]/g, '');

    if (cache.has(normalized)) {
      return cache.get(normalized)!;
    }

    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`,
      );

      if (!res.ok) {
        const result: PronounceResult = {
          word: normalized,
          ipa: null,
          ipaAlt: null,
          audioUrl: null,
        };
        cache.set(normalized, result);
        return result;
      }

      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : data;
      const phonetics = entry?.phonetics || [];
      let ipa: string | null = null;
      let ipaAlt: string | null = null;
      let audioUrl: string | null = null;

      for (const p of phonetics) {
        // IPA uses /slashes/ for phonemic, [brackets] for phonetic — prefer phonemic
        if (p.text && p.text.startsWith('/') && !ipa) {
          ipa = p.text;
        } else if (p.text && p.text.startsWith('[') && !ipaAlt) {
          ipaAlt = p.text;
        }
        if (p.text && p.text.startsWith('/') && ipa && !ipaAlt) {
          ipaAlt = p.text;
        }
        // Fix protocol-relative URLs from the API
        if (p.audio && !audioUrl) {
          audioUrl = p.audio.startsWith('https')
            ? p.audio
            : `https:${p.audio}`;
        }
      }

      const result: PronounceResult = {
        word: normalized,
        ipa: ipa || null,
        ipaAlt: ipaAlt || null,
        audioUrl: audioUrl || null,
      };
      cache.set(normalized, result);
      return result;
    } catch {
      const result: PronounceResult = {
        word: normalized,
        ipa: null,
        ipaAlt: null,
        audioUrl: null,
      };
      cache.set(normalized, result);
      return result;
    }
  }
}