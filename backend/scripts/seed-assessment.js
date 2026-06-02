const AssessmentSentence = require('../src/assessment/entities/assessment-sentence.entity').AssessmentSentence
const { AppDataSource } = require('../src/data-source')

async function seed() {
  await AppDataSource.initialize()
  const repo = AppDataSource.getRepository(AssessmentSentence)

  const sentences = [
    { id: 'a001', level: 'beginner', text: "I usually wake up at seven in the morning, and have breakfast with my family.", audioUrl: '/assessment/audio/a001.mp3', order: 1 },
    { id: 'a002', level: 'elementary', text: "It's kind of hard to explain, but I think you'll understand once you try it.", audioUrl: '/assessment/audio/a002.mp3', order: 2 },
    { id: 'a003', level: 'intermediate', text: "I should have told you about it earlier, but I didn't want to worry you.", audioUrl: '/assessment/audio/a003.mp3', order: 3 },
    { id: 'a004', level: 'advanced', text: "The thing is, even if you know all the words, speaking naturally takes a completely different kind of practice.", audioUrl: '/assessment/audio/a004.mp3', order: 4 },
    { id: 'a005', level: 'fluent', text: "You know what, I was just thinking about that — we should probably figure out what we're gonna do before it gets too late.", audioUrl: '/assessment/audio/a005.mp3', order: 5 },
  ]

  for (const s of sentences) {
    const existing = await repo.findOne({ where: { id: s.id } })
    if (existing) {
      await repo.update(s.id, s)
      console.log(`✓ Updated: ${s.id}`)
    } else {
      await repo.save(repo.create(s))
      console.log(`✓ Inserted: ${s.id}`)
    }
  }

  await AppDataSource.destroy()
  console.log('Done.')
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})