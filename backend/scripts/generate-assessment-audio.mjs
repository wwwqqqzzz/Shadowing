/**
 * Azure TTS assessment audio generator
 *
 * Prerequisites:
 *   1. Azure free tier: https://azure.microsoft.com/free/ → Cognitive Services → Speech
 *   2. Get key + region from Azure Portal → Keys and Endpoint
 *   3. Run:  AZURE_SPEECH_KEY=xxx AZURE_SPEECH_REGION=eastus node generate-assessment-audio.mjs
 *
 * Output: miniprogram/assessment/audio/a001.mp3 ~ a005.mp3
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION || 'eastus';

if (!AZURE_KEY) {
  console.error('Set AZURE_SPEECH_KEY and optionally AZURE_SPEECH_REGION');
  console.error('  AZURE_SPEECH_KEY=your_key AZURE_SPEECH_REGION=eastus node generate-assessment-audio.mjs');
  process.exit(1);
}

const sentences = [
  { id: 'a001', level: 'beginner', rate: '-15%', text: "I usually wake up at seven in the morning, and have breakfast with my family." },
  { id: 'a002', level: 'elementary', rate: '-5%', text: "It's kind of hard to explain, but I think you'll understand once you try it." },
  { id: 'a003', level: 'intermediate', rate: '+0%', text: "I should have told you about it earlier, but I didn't want to worry you." },
  { id: 'a004', level: 'advanced', rate: '+10%', text: "The thing is, even if you know all the words, speaking naturally takes a completely different kind of practice." },
  { id: 'a005', level: 'fluent', rate: '+20%', text: "You know what, I was just thinking about that — we should probably figure out what we're gonna do before it gets too late." },
];

const outputDir = join(__dirname, '..', '..', 'miniprogram', 'assessment', 'audio');
mkdirSync(outputDir, { recursive: true });

async function synthesize(sentence) {
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='en-US-JennyNeural'>
    <prosody rate="${sentence.rate}">
      ${sentence.text}
    </prosody>
  </voice>
</speak>`;

  const url = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
    },
    body: ssml,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure TTS failed (${res.status}): ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = join(outputDir, `${sentence.id}.mp3`);
  writeFileSync(outPath, buffer);
  console.log(`✓ ${sentence.id} (${sentence.level}, rate=${sentence.rate}): ${sentence.text.slice(0, 40)}...`);
}

async function main() {
  console.log(`Region: ${REGION}`);
  console.log(`Output: ${outputDir}\n`);

  for (const s of sentences) {
    try {
      await synthesize(s);
    } catch (err) {
      console.error(`✗ ${s.id} failed:`, err.message);
    }
  }

  console.log('\nDone. Files are in miniprogram/assessment/audio/');
}

main();