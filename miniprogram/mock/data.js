const mockMaterials = {
  'mock-001': {
    id: 'mock-001',
    title: 'TED: The power of vulnerability',
    language: 'en',
    level: 'intermediate',
    audioUrl: '/mock/audio/sample.mp3',
    sentences: [
      {
        id: 's001',
        startTime: 400,
        endTime: 7500,
        audioUrl: '/mock/audio/sentence-1.mp3',
        text: "So, I'll start with this: a couple years ago, an event planner called me because I was going to do a speaking event.",
        translation: '那么，我先从这件事说起：几年前，一位活动策划人打电话给我，因为我准备做一个演讲。',
        order: 1
      },
      {
        id: 's002',
        startTime: 7700,
        endTime: 13500,
        audioUrl: '/mock/audio/sentence-2.mp3',
        text: "And she called, and she said, I'm really struggling with how to write about you on the little flyer.",
        translation: '她打电话来说：我真的很难在宣传单上介绍你。',
        order: 2
      },
      {
        id: 's003',
        startTime: 13700,
        endTime: 23700,
        audioUrl: '/mock/audio/sentence-3.mp3',
        text: "And I thought, Well, what's the struggle? And she said, Well, I saw you speak, and I'm going to call you a researcher, I think, but I'm afraid if I call you a researcher, no one will come, because they'll think you're boring and irrelevant.",
        translation: '我就想：有什么难的？然后她说：我看过你的演讲，我想称你为研究者，但我担心如果这样叫，没人会来，因为他们会觉得你又无聊又没意思。',
        order: 3
      },
      {
        id: 's004',
        startTime: 24300,
        endTime: 29600,
        audioUrl: '/mock/audio/sentence-4.mp3',
        text: "And I was like, Okay. And she said, But the thing I liked about your talk is you're a storyteller.",
        translation: '我就说：好吧。然后她说：但我喜欢你演讲的一点是，你是个讲故事的人。',
        order: 4
      }
    ]
  }
}

function getMockMaterial(id) {
  return mockMaterials[id] || null
}

module.exports = {
  getMockMaterial,
  mockMaterials
}
