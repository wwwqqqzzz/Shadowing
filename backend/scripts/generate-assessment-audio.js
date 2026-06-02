const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sentences = [
  {
    id: 'a001',
    level: 'beginner',
    text: "I usually wake up at seven in the morning and have breakfast with my family.",
  },
  {
    id: 'a002',
    level: 'elementary',
    text: "It's kind of hard to explain, but I think you'll understand once you try it.",
  },
  {
    id: 'a003',
    level: 'intermediate',
    text: "I should have told you about it earlier, but I didn't want to worry you.",
  },
  {
    id: 'a004',
    level: 'advanced',
    text: "The thing is, even if you know all the words, speaking naturally takes a completely different kind of practice.",
  },
  {
    id: 'a005',
    level: 'fluent',
    text: "You know what, I was just thinking about that — we should probably figure out what we're gonna do before it gets too late.",
  },
];

async function main() {
  const outputDir = path.join(__dirname, '..', 'assessment', 'audio');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const s of sentences) {
    const speed = s.level === 'beginner' ? 0.85 : s.level === 'fluent' ? 1.1 : 1.0;
    const response = await client.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'alloy',
      input: s.text,
      speed,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(outputDir, `${s.id}.mp3`), buffer);
    console.log(`✓ ${s.id}: ${s.text.slice(0, 40)}...`);
  }

  console.log('\nDone. Copy to miniprogram:');
  console.log(`  cp ${outputDir}/*.mp3 ../miniprogram/assessment/audio/`);
}

main().catch(console.error);