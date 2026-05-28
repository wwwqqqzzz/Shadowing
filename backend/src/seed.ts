import { DataSource } from 'typeorm';
import { Material } from './materials/entities/material.entity';
import { Sentence } from './sentences/entities/sentence.entity';
import { PracticeRecord } from './practice-records/entities/practice-record.entity';
import { User } from './users/entities/user.entity';

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'wang',
    password: process.env.DATABASE_PASS || '',
    database: process.env.DATABASE_NAME || 'shadowing_dev',
    entities: [Material, Sentence, PracticeRecord, User],
    synchronize: true,
  });

  await ds.initialize();
  console.log('📦 Connected. Seeding data...');

  const materialRepo = ds.getRepository(Material);
  const sentenceRepo = ds.getRepository(Sentence);

  const seedId = '00000000-0000-0000-0000-000000000001';
  const existing = await materialRepo.findOne({ where: { id: seedId } });
  if (existing) {
    console.log('Seed data already exists, skipping.');
    await ds.destroy();
    return;
  }

  const material = materialRepo.create({
    id: seedId,
    title: 'TED: The power of vulnerability',
    language: 'en',
    level: 'intermediate',
    audioUrl: '/mock/audio/sample.mp3',
    durationMs: 29600,
    status: 'published',
    source: 'TED',
  });
  await materialRepo.save(material);
  console.log('✅ Material created:', material.title);

  const sentencesData = [
    {
      id: '00000000-0000-0000-0000-000000000101',
      order: 1,
      startTime: 400,
      endTime: 7500,
      text: "So, I'll start with this: a couple years ago, an event planner called me because I was going to do a speaking event.",
      translation: '那么，我先从这件事说起：几年前，一位活动策划人打电话给我，因为我准备做一个演讲。',
      audioUrl: '/mock/audio/sentence-1.mp3',
      material,
    },
    {
      id: '00000000-0000-0000-0000-000000000102',
      order: 2,
      startTime: 7700,
      endTime: 13500,
      text: "And she called, and she said, I'm really struggling with how to write about you on the little flyer.",
      translation: '她打电话来说：我真的很难在宣传单上介绍你。',
      audioUrl: '/mock/audio/sentence-2.mp3',
      material,
    },
    {
      id: '00000000-0000-0000-0000-000000000103',
      order: 3,
      startTime: 13700,
      endTime: 23700,
      text: "And I thought, Well, what's the struggle? And she said, Well, I saw you speak, and I'm going to call you a researcher, I think, but I'm afraid if I call you a researcher, no one will come, because they'll think you're boring and irrelevant.",
      translation: '我就想：有什么难的？然后她说：我看过你的演讲，我想称你为研究者，但我担心如果这样叫，没人会来，因为他们会觉得你又无聊又没意思。',
      audioUrl: '/mock/audio/sentence-3.mp3',
      material,
    },
    {
      id: '00000000-0000-0000-0000-000000000104',
      order: 4,
      startTime: 24300,
      endTime: 29600,
      text: "And I was like, Okay. And she said, But the thing I liked about your talk is you're a storyteller.",
      translation: '我就说：好吧。然后她说：但我喜欢你演讲的一点是，你是个讲故事的人。',
      audioUrl: '/mock/audio/sentence-4.mp3',
      material,
    },
  ];

  const sentences = sentencesData.map((data) => sentenceRepo.create(data));
  await sentenceRepo.save(sentences);
  console.log(`✅ ${sentences.length} sentences created.`);

  await ds.destroy();
  console.log('🎉 Seed complete!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
