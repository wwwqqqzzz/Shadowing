import { Injectable, Logger } from '@nestjs/common';
const FormData = require('form-data');
const fetch = require('node-fetch');

export interface WordResult {
  word: string;
  status: 'correct' | 'missing' | 'extra' | 'mispronounced';
  index: number;
  recognized?: string;
}

export interface CompareResult {
  score: number;
  missingWords: string[];
  extraWords: string[];
  errorCount: number;
  wordResults: WordResult[];
  recognizedText: string;
  originalText: string;
}

@Injectable()
export class AsrService {
  private readonly logger = new Logger(AsrService.name);
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

  /**
   * SequenceMatcher-based word-level alignment.
   * Replaces the old Set-based comparison that ignored word order.
   */
  compare(original: string, recognized: string): CompareResult {
    const clean = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\w\s']/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const origWords = clean(original);
    const recogWords = clean(recognized);

    // SequenceMatcher alignment using longest common subsequence approach
    const wordResults: WordResult[] = [];
    const opcodes = this._getOpCodes(origWords, recogWords);

    let origIdx = 0;
    const missingWords: string[] = [];
    const extraWords: string[] = [];

    for (const { tag, i1, i2, j1, j2 } of opcodes) {
      if (tag === 'equal') {
        for (let k = i1; k < i2; k++) {
          wordResults.push({ word: origWords[k], status: 'correct', index: k });
          origIdx++;
        }
      } else if (tag === 'delete') {
        // Words in original that are missing from recognized
        for (let k = i1; k < i2; k++) {
          wordResults.push({ word: origWords[k], status: 'missing', index: k });
          missingWords.push(origWords[k]);
          origIdx++;
        }
      } else if (tag === 'insert') {
        // Extra words in recognized that don't match original
        for (let k = j1; k < j2; k++) {
          wordResults.push({ word: recogWords[k], status: 'extra', index: -1 });
          extraWords.push(recogWords[k]);
        }
      } else if (tag === 'replace') {
        // Words that were replaced/mispronounced
        // Map each original word as mispronounced, extra recognized words as extra
        const origSegment = origWords.slice(i1, i2);
        const recogSegment = recogWords.slice(j1, j2);

        for (let k = 0; k < origSegment.length; k++) {
          const matchedRecog = k < recogSegment.length ? recogSegment[k] : undefined;
          wordResults.push({
            word: origSegment[k],
            status: 'mispronounced',
            index: i1 + k,
            recognized: matchedRecog,
          });
          origIdx++;
        }
        // If recognized has more words than original in this segment, mark extras
        if (recogSegment.length > origSegment.length) {
          for (let k = origSegment.length; k < recogSegment.length; k++) {
            wordResults.push({ word: recogSegment[k], status: 'extra', index: -1 });
            extraWords.push(recogSegment[k]);
          }
        }
      }
    }

    // Score: correct words / total original words
    const correctCount = wordResults.filter(
      (r) => r.status === 'correct',
    ).length;
    const totalOrig = origWords.length;
    const score = totalOrig > 0 ? Math.round((correctCount / totalOrig) * 100) : 0;

    return {
      score,
      missingWords: [...new Set(missingWords)],
      extraWords: [...new Set(extraWords)],
      errorCount: missingWords.length,
      wordResults,
      recognizedText: recognized,
      originalText: original,
    };
  }

  /**
   * Enhanced evaluation using DeepSeek LLM for ambiguous cases.
   * Called when SequenceMatcher score is in the ambiguous range (40-80).
   * Returns LLM-adjusted wordResults or null if LLM call fails.
   */
  async evaluateWithLLM(
    originalText: string,
    recognizedText: string,
    algorithmicResult: CompareResult,
  ): Promise<{ wordResults: WordResult[]; score: number; llmUsed: true } | null> {
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    if (!DEEPSEEK_API_KEY) {
      this.logger.warn('DEEPSEEK_API_KEY not set, skipping LLM evaluation');
      return null;
    }

    const prompt = `You are an English pronunciation evaluator. Compare the original sentence with what the student said (recognized by ASR).

Original: "${originalText}"
Recognized: "${recognizedText}"

For each word in the original sentence, determine its status:
- "correct": word was said correctly
- "missing": word was skipped entirely
- "mispronounced": word was said but incorrectly (similar-sounding word detected)
- "extra": word appeared in recognized but not in original (goes in separate list)

Be lenient with minor ASR artifacts:
- Contractions: "don't" vs "do not" → treat as correct
- Common homophones: "there"/"their"/"they're" → treat as correct
- Natural contractions in speech: "gonna" for "going to" → treat as correct for "going"
- Punctuation differences should be ignored

Reply with ONLY a JSON object (no markdown, no explanation):
{
  "words": [
    {"word": "...", "status": "correct|missing|mispronounced", "recognized": "..." }
  ],
  "score": <number 0-100>,
  "extraWords": ["word1"],
  "overallAssessment": "brief 5-word max assessment"
}`;

    try {
      const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
        timeout: 8000,
      });

      if (!response.ok) {
        this.logger.warn(`DeepSeek API returned ${response.status}, falling back to algorithmic result`);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn('Empty DeepSeek response, falling back');
        return null;
      }

      const parsed = JSON.parse(content);
      const wordResults: WordResult[] = (parsed.words || []).map(
        (w: any, idx: number) => ({
          word: w.word,
          status: w.status as 'correct' | 'missing' | 'mispronounced',
          index: idx,
          recognized: w.recognized,
        }),
      );

      return {
        wordResults,
        score: Math.min(100, Math.max(0, parsed.score ?? algorithmicResult.score)),
        llmUsed: true,
      };
    } catch (err) {
      this.logger.warn(`DeepSeek LLM call failed: ${err instanceof Error ? err.message : String(err)}, falling back`);
      return null;
    }
  }

  /**
   * SequenceMatcher opcodes implementation.
   * Returns alignment between two word sequences.
   */
  private _getOpCodes(
    a: string[],
    b: string[],
  ): Array<{ tag: 'equal' | 'delete' | 'insert' | 'replace'; i1: number; i2: number; j1: number; j2: number }> {
    // Build LCS-based alignment
    const m = a.length;
    const n = b.length;

    // DP table for longest common subsequence
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find alignment
    const opcodes: Array<{ tag: 'equal' | 'delete' | 'insert' | 'replace'; i1: number; i2: number; j1: number; j2: number }> = [];
    let i = m;
    let j = n;

    // Collect raw alignment pairs
    const alignments: Array<{ ai: number; bi: number; type: 'match' | 'mismatch' }> = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        alignments.unshift({ ai: i - 1, bi: j - 1, type: 'match' });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        j--;
      } else {
        i--;
      }
    }

    // Convert alignment to opcodes
    let ai = 0;
    let bi = 0;

    for (const align of alignments) {
      // Handle unmatched a words before this alignment point
      if (align.type === 'match') {
        const unmatchedA = align.ai - ai;
        const unmatchedB = align.bi - bi;

        if (unmatchedA > 0 && unmatchedB > 0) {
          opcodes.push({ tag: 'replace', i1: ai, i2: ai + Math.min(unmatchedA, unmatchedB), j1: bi, j2: bi + Math.min(unmatchedA, unmatchedB) });
          if (unmatchedA > unmatchedB) {
            opcodes.push({ tag: 'delete', i1: ai + unmatchedB, i2: ai + unmatchedA, j1: align.bi, j2: align.bi });
          } else if (unmatchedB > unmatchedA) {
            opcodes.push({ tag: 'insert', i1: ai + unmatchedA, i2: ai + unmatchedA, j1: bi + unmatchedA, j2: bi + unmatchedB });
          }
        } else if (unmatchedA > 0) {
          opcodes.push({ tag: 'delete', i1: ai, i2: ai + unmatchedA, j1: align.bi, j2: align.bi });
        } else if (unmatchedB > 0) {
          opcodes.push({ tag: 'insert', i1: align.ai, i2: align.ai, j1: bi, j2: bi + unmatchedB });
        }

        opcodes.push({ tag: 'equal', i1: align.ai, i2: align.ai + 1, j1: align.bi, j2: align.bi + 1 });
        ai = align.ai + 1;
        bi = align.bi + 1;
      }
    }

    // Handle trailing unmatched words
    if (ai < a.length || bi < b.length) {
      const trailingA = a.length - ai;
      const trailingB = b.length - bi;
      if (trailingA > 0 && trailingB > 0) {
        opcodes.push({ tag: 'replace', i1: ai, i2: a.length, j1: bi, j2: b.length });
      } else if (trailingA > 0) {
        opcodes.push({ tag: 'delete', i1: ai, i2: a.length, j1: b.length, j2: b.length });
      } else if (trailingB > 0) {
        opcodes.push({ tag: 'insert', i1: a.length, i2: a.length, j1: bi, j2: b.length });
      }
    }

    // Simplify: convert length-1 opcodes list if empty
    if (opcodes.length === 0) {
      if (a.length === 0 && b.length === 0) return [];
      if (a.length === 0) return [{ tag: 'insert', i1: 0, i2: 0, j1: 0, j2: b.length }];
      if (b.length === 0) return [{ tag: 'delete', i1: 0, i2: a.length, j1: 0, j2: 0 }];
      return [{ tag: 'replace', i1: 0, i2: a.length, j1: 0, j2: b.length }];
    }

    return opcodes;
  }
}