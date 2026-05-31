// Mock data for Phase 0 — based on real VTT timestamps from ted.en.vtt
// Audio: ted.mp3 (full TED talk), seek mode — no per-sentence audio files
// Opening warmup ("Greetings followers" / "And settle in" at 3.7-8.4s) is skipped

const mockMaterials = {
  'mock-001': {
    id: 'mock-001',
    title: 'Amanda Montell: The secret slang of cults',
    language: 'en',
    level: 'intermediate',
    audioUrl: '/mock/audio/ted.mp3',
    audioOffsetMs: 0,
    sentences: [
      {
        id: 's001',
        startTime: 8906,
        endTime: 16914,
        text: "Because I'm about to share with you a true story about one of the most zealous cults in the world.",
        translation: '因为我要和你们分享一个关于世界上最狂热邪教的真实故事。',
        order: 1
      },
      {
        id: 's002',
        startTime: 17448,
        endTime: 27324,
        text: "The story takes place on the group's holiest day. Acolytes arrived at dawn, some having crossed oceans and sacrificed life savings in order to get there.",
        translation: '故事发生在该组织最神圣的日子里。门徒们黎明到达，有些人穿越了海洋并牺牲了毕生积蓄才来到这里。',
        order: 2
      },
      {
        id: 's003',
        startTime: 27658,
        endTime: 35466,
        text: 'They came bearing hand-beaded offerings inscribed with sacred numbers: 22, 13, 89.',
        translation: '他们带来了手工串珠的供品，上面刻着神圣数字：22、13、89。',
        order: 3
      },
      {
        id: 's004',
        startTime: 35499,
        endTime: 43541,
        text: "But this, my friends, is not the story of an apocalyptic sect on a faraway compound. No, this was a Taylor Swift concert.",
        translation: '但是朋友们，这不是一个关于遥远地区末日教派的故事。不，这是一场泰勒·斯威夫特演唱会。',
        order: 4
      },
      {
        id: 's005',
        startTime: 45576,
        endTime: 57121,
        text: "I said it. The talismans are friendship bracelets, the biblical books are known as eras, and the charismatic leader is a billionaire pop priestess who, let's be honest, could probably rule the free world if she really wanted to.",
        translation: '我就说了。那些护身符就是友谊手链，那些圣经般典籍被称为"时代"，而那个魅力领袖是一位亿万富翁流行女祭司，说实话，她如果想的话可能可以统治自由世界。',
        order: 5
      },
      {
        id: 's006',
        startTime: 58155,
        endTime: 65296,
        text: "Now, don't get me wrong. I'm a deep-dyed \"Red\" album girlie. I'm not here to call out Swifties as cult followers. No, I wouldn't dare.",
        translation: '别误会。我是铁杆"Red"专辑粉丝。我不是来指责霉粉是邪教信徒的。不，我可不敢。',
        order: 6
      },
      {
        id: 's007',
        startTime: 67498,
        endTime: 72069,
        text: "But I'm an author and a cultural commentator with a background in linguistics.",
        translation: '但我是一名有语言学背景的作家和文化评论员。',
        order: 7
      },
      {
        id: 's008',
        startTime: 72103,
        endTime: 82813,
        text: "And I'm here to share how we're all susceptible to cult-ish thinking, for better and for worse. And our everyday vocabularies are evidence of our devotion.",
        translation: '我来分享我们如何都容易受到类邪教思维的影响，无论好坏。我们日常的词汇就是我们虔诚的证据。',
        order: 8
      },
      {
        id: 's009',
        startTime: 83447,
        endTime: 94058,
        text: "I'm here to share what to pay attention to, what to listen for, so that, as we move through these inevitably culty times, we can stay both enchanted and empowered.",
        translation: '我来分享需要注意什么，倾听什么，这样当我们在这些不可避免的邪教式时代中前行时，能既保持迷又保持力量。',
        order: 9
      },
      {
        id: 's010',
        startTime: 95092,
        endTime: 109173,
        text: "Now, my fascination with cults is personal. That's because of my dad. As a teenager, he was forced to join Synanon, a '70s California compound with matching overalls and a traumatizing truth-telling ritual called The Game.",
        translation: '我对邪教的痴迷是个人原因。那是因为我爸爸。他十几岁时被迫加入了圣纳农，一个70年代加州的公社，穿着统一的工作服，有一种叫做"游戏"的令人痛苦的真话仪式。',
        order: 10
      },
      {
        id: 's011',
        startTime: 109740,
        endTime: 120618,
        text: "But my dad escaped, became a neuroscientist, and brought up a nosy kid who became obsessed with understanding how to identify cultish influence in everyday life.",
        translation: '但我爸爸逃出来了，成了一名神经科学家，养育了一个好奇的孩子，这个人着迷于理解如何识别日常生活中的邪教式影响。',
        order: 11
      },
      {
        id: 's012',
        startTime: 121685,
        endTime: 133464,
        text: "As I got older, I couldn't help but notice that the same language tactics that my dad described in Synanon could be found kind of everywhere. Like, in my high school theater program and in the wellness industry and on my social media feed.",
        translation: '随着年龄增长，我不禁注意到我爸爸描述的圣纳农中同样的语言策略几乎到处都能找到。比如在我的高中戏剧项目中，在健康行业中，在我的社交媒体上。',
        order: 12
      },
      {
        id: 's013',
        startTime: 138169,
        endTime: 148512,
        text: "That's how I came to study the cultish spectrum, degrees of influence, none of which start out with LSD and robes, but instead, sneakily, with words.",
        translation: '这就是我如何开始研究邪教光谱的——不同程度的影响力，都不是从迷幻药和长袍开始的，而是偷偷摸摸地，从语言开始。',
        order: 13
      },
      {
        id: 's014',
        startTime: 149747,
        endTime: 156320,
        text: "I want to point out three cultish language tactics to listen for in everyday life. The first is called the thought-terminating cliche.",
        translation: '我想指出三种日常生活中的邪教式语言策略。第一种叫做"思维终结陈词滥调"。',
        order: 14
      },
      {
        id: 's015',
        startTime: 156320,
        endTime: 168232,
        text: "Coined in 1961 by the psychiatrist Robert Jay Lifton, thought-terminating cliches are zingy stack expressions that are easy to memorize, easy to repeat and aimed at shutting down independent thinking and questioning.",
        translation: '思维终结陈词滥调由精神科医生罗伯特·杰伊·利夫顿在1961年创造，是那些容易记忆、容易重复的时髦套话，目的是压制独立思考和质疑。',
        order: 15
      },
      {
        id: 's016',
        startTime: 168532,
        endTime: 179610,
        text: "So let's say you're a member of a group, and there's a rule that you want to push back against. You might get hit with a phrase like, \"trust the process,\" or \"it's all in God's plan\" to shut you down.",
        translation: '假设你是一个团体的成员，有一条你想反对的规定。你可能听到这样的话："相信过程"，或者"这是上帝的安排"来堵住你。',
        order: 16
      },
      {
        id: 's017',
        startTime: 180311,
        endTime: 186483,
        text: "In Synanon, the phrase \"act as if\" effectively meant pretend that you believe until you do.",
        translation: '在圣纳农中，"假装相信"这个说法实际上意味着假装你相信直到你真的相信。',
        order: 17
      },
      {
        id: 's018',
        startTime: 186951,
        endTime: 193757,
        text: "Today, in conspiracy theory-type groups, the phrase \"do your research\" basically means \"stop asking me about mine.\"",
        translation: '今天，在阴谋论类型的群体中，"做你自己的研究"这句话基本上意味着"别再问我关于我的研究了"。',
        order: 18
      },
      {
        id: 's019',
        startTime: 194992,
        endTime: 201098,
        text: "Next, I want to talk about \"us\" versus \"them\" labels. In Synanon, defectors were called \"splitees.\"",
        translation: '接下来，我想谈谈"我们"与"他们"的标签。在圣纳农中，叛逃者被称为"分裂者"。',
        order: 19
      },
      {
        id: 's020',
        startTime: 201098,
        endTime: 205302,
        text: "Today, you've got your \"sheeple,\" your \"NPCs,\" your \"industry plants.\"",
        translation: '今天，你有"羊群"、"NPC"、"行业卧底"这些标签。',
        order: 20
      },
      {
        id: 's021',
        startTime: 205936,
        endTime: 212309,
        text: "When a label makes all of those people seem unilaterally evil and us superior, that's a red flag.",
        translation: '当一个标签让所有那些人看起来一面倒地邪恶而我们优越时，那就是一个危险信号。',
        order: 21
      },
      {
        id: 's022',
        startTime: 212710,
        endTime: 223387,
        text: "And thirdly, I want to mention loaded language. Corporate synergistic visionaries. Wellness 5D consciousness. At first, emotionally charged buzzwords like this feel like enlightenment.",
        translation: '第三，我想提到负载语言。企业协同远见者。健康5维意识。起初，像这样充满情感的流行词让人感觉像启蒙。',
        order: 22
      },
      {
        id: 's023',
        startTime: 223854,
        endTime: 229927,
        text: "Then one day you wake up and you realize you've completely surrendered your ability to talk and think for yourself.",
        translation: '然后有一天你醒来，你意识到你已经完全交出了自己独立思考和说话的能力。',
        order: 23
      },
      {
        id: 's024',
        startTime: 230961,
        endTime: 243941,
        text: "This language works because it plugs straight into our cognitive biases. These deeply ingrained decision-making shortcuts that developed in earlier human brains to help us process information from the world around us enough to survive it.",
        translation: '这种语言之所以有效，是因为它直接连接到了我们的认知偏见。这些根深蒂固的决策捷径在早期人类大脑中发展出来，帮助我们处理周围世界的信息以求生存。',
        order: 24
      },
      {
        id: 's025',
        startTime: 243974,
        endTime: 258289,
        text: "But today, mental magic tricks like confirmation bias, the sunk cost fallacy, and the halo effect cause us to believe only the information we already agree with, double down on sketchy choices and worship mortal human beings we've never even met as all-knowing deities.",
        translation: '但今天，像确认偏见、沉没成本谬误和光环效应这样的心理魔术技巧，让我们只相信已经认同的信息，在可疑选择上加倍下注，并把从没见过的凡人当作全知神明来崇拜。',
        order: 25
      },
      {
        id: 's026',
        startTime: 260758,
        endTime: 269466,
        text: "This clash between our once useful cognitive biases and the information age is this phenomenon that I've been calling magical overthinking.",
        translation: '我们曾经有用的认知偏见与信息时代之间的冲突，就是我一直在说的"魔幻过度思考"。',
        order: 26
      },
      {
        id: 's027',
        startTime: 270067,
        endTime: 279510,
        text: "And it's a problem because studies show that social media has damaged our mental health and our attention spans, all the while making cultish leaders mega accessible.",
        translation: '这确实是个问题，因为研究表明社交媒体损害了我们的心理健康和注意力，同时让邪教式领袖变得极度容易接触。',
        order: 27
      },
      {
        id: 's028',
        startTime: 279943,
        endTime: 295559,
        text: "Who needs compounds when you have comment sections? Now, I don't say this to freak anyone out. I'm just here to point out the difference between awe and indoctrination. And I want to leave us with a few tips to help us do that.",
        translation: '既然有评论区，还需要什么营地吗？我不是要吓唬任何人。我只是想指出敬畏与灌输之间的区别。我想留下几个建议帮助我们做到这一点。',
        order: 28
      },
      {
        id: 's029',
        startTime: 295592,
        endTime: 312843,
        text: "First of all, when you find yourself in a space, even a digital one, where you feel really emotionally activated and you're using a lot of buzzwords that make you feel like you're part of a tribe, but you can't really define exactly what you're saying in plain English, or why, that's a sign to take a step back and consult other sources.",
        translation: '首先，当你发现自己在一个空间——即使是数字空间——感到情绪被激活，使用大量让你感觉属于部落的流行词，但无法用简单的英语准确定义你在说什么或为什么——这是退后一步并咨询其他来源的信号。',
        order: 29
      },
      {
        id: 's030',
        startTime: 312876,
        endTime: 321185,
        text: "Next, pay attention to exit costs. Healthy groups might make leaving feel awkward, but never apocalyptic or earth-shattering.",
        translation: '接下来，注意退出成本。健康的团体可能会让离开感觉尴尬，但永远不会是末日般的或翻天覆地的。',
        order: 30
      },
      {
        id: 's031',
        startTime: 321218,
        endTime: 330694,
        text: "And finally, we can use cult language for good. Rousing chants, rhyming mantras, they can be used to make true information catchy, too.",
        translation: '最后，我们可以用邪教式语言做善事。激昂的口号、押韵的咒语，它们也可以让真实信息变得朗朗上口。',
        order: 31
      },
      {
        id: 's032',
        startTime: 331528,
        endTime: 336834,
        text: "I'm not here to take away anyone's friendship bracelets. We need community more now than ever.",
        translation: '我不是来夺走任何人的友谊手链的。我们现在比以往任何时候都更需要社区。',
        order: 32
      },
      {
        id: 's033',
        startTime: 337668,
        endTime: 348545,
        text: "So I think living in this cultiest era of all time, the goal is not so much to be cult-proof, it's to be cult-literate.",
        translation: '所以我认为在这个史上最邪教化的时代生活，目标与其说要防邪教，不如说要具备邪教素养。',
        order: 33
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