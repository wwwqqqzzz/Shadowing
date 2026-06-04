#!/usr/bin/env node
/**
 * Contract test for /api/asr/evaluate.
 * Validates the response shape that miniprogram/pages/practice/practice.js depends on.
 * Run: node scripts/verify-eval.js
 * Exit 0 = pass, 1 = fail.
 */

const path = require('path');
const fs = require('fs');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const EVAL_URL = `${BACKEND_URL}/api/asr/evaluate`;
const TEST_AUDIO = path.resolve(__dirname, '..', 'ted.mp3');

const REQUIRED_FIELDS = [
  'score',
  'missingWords',
  'extraWords',
  'errorCount',
  'wordResults',
  'recognizedText',
  'originalText',
  'llmUsed',
];

const VALID_WORD_STATUSES = new Set(['correct', 'missing', 'extra', 'mispronounced']);

function ok(label, detail) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? ': ' + detail : ''}`);
}
function fail(label, detail) {
  console.error(`  \x1b[31m✗\x1b[0m ${label}${detail ? ': ' + detail : ''}`);
}

async function main() {
  console.log(`\n\x1b[1mContract test: ${EVAL_URL}\x1b[0m\n`);

  if (!fs.existsSync(TEST_AUDIO)) {
    fail('test audio missing', TEST_AUDIO);
    process.exit(1);
  }

  const audioBuffer = fs.readFileSync(TEST_AUDIO);
  const form = new FormData();
  form.append('audio', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'test.mp3');
  form.append('language', 'en');
  form.append('originalText', 'hello world how are you');

  let res;
  try {
    res = await fetch(EVAL_URL, { method: 'POST', body: form });
  } catch (e) {
    fail('network error', e.message);
    console.error(`\n  Is backend running? Try: cd backend && npm run start:full\n`);
    process.exit(1);
  }

  if (res.status !== 200 && res.status !== 201) {
    fail('HTTP status', `${res.status} (expected 200 or 201)`);
    const body = await res.text();
    console.error(`  body: ${body.slice(0, 200)}`);
    if (res.status === 500) {
      console.error(`\n  Likely asr-service (:8000) is down. Backend prints "⚠️" warning at startup.`);
    }
    process.exit(1);
  }
  ok(`HTTP ${res.status}`);

  const data = await res.json();

  let failed = false;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      fail(`missing field`, field);
      failed = true;
    } else {
      ok(`field present`, `${field} = ${JSON.stringify(data[field]).slice(0, 60)}`);
    }
  }

  if (failed) {
    console.error(`\n\x1b[31m✗ Contract violated\x1b[0m — practice.js may break.\n`);
    process.exit(1);
  }

  if (typeof data.score !== 'number' || data.score < 0 || data.score > 100) {
    fail('score range', `expected 0-100, got ${data.score}`);
    process.exit(1);
  }
  ok('score range', `${data.score} (0-100)`);

  if (!Array.isArray(data.wordResults)) {
    fail('wordResults is array');
    process.exit(1);
  }
  if (data.wordResults.length === 0) {
    fail('wordResults empty', 'expected at least 1 word result');
    process.exit(1);
  }
  ok('wordResults non-empty', `${data.wordResults.length} entries`);

  const sample = data.wordResults[0];
  if (!('word' in sample) || !('status' in sample) || !('index' in sample)) {
    fail('wordResults[0] shape', 'needs {word, status, index}');
    process.exit(1);
  }
  if (!VALID_WORD_STATUSES.has(sample.status)) {
    fail('wordResults[0].status', `got "${sample.status}", valid: ${[...VALID_WORD_STATUSES].join(', ')}`);
    process.exit(1);
  }
  ok('wordResults[0] shape', `{word: "${sample.word}", status: "${sample.status}", index: ${sample.index}}`);

  if (data.originalText !== 'hello world how are you') {
    fail('originalText echo', `expected "hello world how are you", got "${data.originalText}"`);
    process.exit(1);
  }
  ok('originalText echo', `"${data.originalText}"`);

  console.log(`\n\x1b[32m✓ All contract checks passed\x1b[0m — practice.js will receive valid data.\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n\x1b[31m✗ Unexpected error:\x1b[0m ${e.message}\n`);
  process.exit(1);
});
