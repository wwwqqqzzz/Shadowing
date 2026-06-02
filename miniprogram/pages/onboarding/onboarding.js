const request = require('../../utils/request')
const { isLoggedIn, login } = require('../../utils/auth')

const LEVELS = [
  { key: 'beginner', name: '入门', desc: '刚开始学，基础发音' },
  { key: 'elementary', name: '基础', desc: '能说简单句子，但不流畅' },
  { key: 'intermediate', name: '中级', desc: '日常交流没问题，想更自然' },
  { key: 'advanced', name: '进阶', desc: '比较流利，想练语调和节奏' },
  { key: 'fluent', name: '流利', desc: '已经很流利，追求母语质感' },
]

Page({
  data: {
    step: 1,
    levels: LEVELS,
    selfReportedLevel: '',
    currentSentenceIndex: 0,
    sentences: [],
    assessmentResults: [],
    assessmentResponse: null,
    playing: false,
    recording: false,
    status: 'idle',
    feedback: null,
  },

  recorder: null,
  _currentAudio: null,
  _autoNextTimer: null,
  _feedbackTimeout: null,

  onLoad() {
    this.recorder = wx.getRecorderManager()
    this.recorder.onStart(() => this.setData({ recording: true }))
    this.recorder.onStop((res) => {
      this.setData({ recording: false })
      this._evaluateRecording(res.tempFilePath)
    })
    this.recorder.onError(() => this.setData({ recording: false }))
  },

  onUnload() {
    if (this._autoNextTimer) { clearTimeout(this._autoNextTimer); this._autoNextTimer = null }
    if (this._feedbackTimeout) { clearTimeout(this._feedbackTimeout); this._feedbackTimeout = null }
    if (this._currentAudio) { this._currentAudio.stop(); this._currentAudio.destroy(); this._currentAudio = null }
    this.recorder && this.recorder.stop()
  },

  onSelectLevel(e) {
    this.setData({ selfReportedLevel: e.currentTarget.dataset.level })
  },

  onNext() {
    if (!this.data.selfReportedLevel) {
      wx.showToast({ title: '请选择你的水平', icon: 'none' })
      return
    }
    this.setData({ step: 2 })
  },

  onStartAssessment() {
    this.setData({ step: 3 })
    this._loadSentences()
  },

  onSkipAssessment() {
    this._submitAssessment(true)
  },

  async _loadSentences() {
    try {
      const res = await request({ url: '/assessment/sentences' })
      this.setData({ sentences: res, currentSentenceIndex: 0, assessmentResults: [], status: 'idle' })
      this._playCurrentSentence()
    } catch (err) {
      console.error('加载测评句失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  _playCurrentSentence() {
    const { sentences, currentSentenceIndex } = this.data
    const sentence = sentences[currentSentenceIndex]
    if (!sentence) return

    if (this._currentAudio) {
      this._currentAudio.stop()
      this._currentAudio.destroy()
    }

    const ac = wx.createInnerAudioContext()
    ac.obeyMuteSwitch = false
    let url = sentence.audioUrl
    if (url && !url.startsWith('http') && !url.startsWith('wxfile://')) {
      url = 'http://localhost:3000/audio' + url
    }
    ac.src = url
    ac.onEnded(() => {
      this.setData({ playing: false, status: 'waiting' })
      setTimeout(() => this._startRecording(), 500)
    })
    ac.onError(() => {
      this.setData({ playing: false, status: 'waiting' })
      setTimeout(() => this._startRecording(), 500)
    })
    this._currentAudio = ac
    this.setData({ playing: true, status: 'playing' })
    ac.play()
  },

  _startRecording() {
    const sentence = this.data.sentences[this.data.currentSentenceIndex]
    if (!sentence) return
    const sentenceLen = sentence.endTime ? sentence.endTime - (sentence.startTime || 0) : 8000
    const recordDuration = Math.min(Math.max(sentenceLen + 2000, 8000), 30000)
    this.recorder.start({
      format: 'mp3',
      sampleRate: 16000,
      numberOfChannels: 1,
      duration: recordDuration,
    })
    this._autoNextTimer = setTimeout(() => {
      if (this.data.recording) this.recorder.stop()
      this._feedbackTimeout = setTimeout(() => this._advanceToNext(), 5000)
    }, recordDuration + 500)
  },

  _evaluateRecording(tempFilePath) {
    const sentence = this.data.sentences[this.data.currentSentenceIndex]
    if (!sentence) return

    wx.uploadFile({
      url: 'http://localhost:3000/api/asr/evaluate',
      filePath: tempFilePath,
      name: 'audio',
      formData: { sentenceId: sentence.id, language: 'en', originalText: sentence.text },
      success: (res) => {
        const result = JSON.parse(res.data)
        this.setData({ feedback: result })
        const results = [...this.data.assessmentResults, { sentenceId: sentence.id, score: result.score || 0, recognizedText: result.recognizedText || '' }]
        this.setData({ assessmentResults: results })
        if (this._feedbackTimeout) { clearTimeout(this._feedbackTimeout); this._feedbackTimeout = null }
        this._autoNextTimer = setTimeout(() => this._advanceToNext(), 2000)
      },
      fail: () => {
        const results = [...this.data.assessmentResults, { sentenceId: sentence.id, score: 0, recognizedText: '' }]
        this.setData({ assessmentResults: results })
        if (this._feedbackTimeout) { clearTimeout(this._feedbackTimeout); this._feedbackTimeout = null }
        this._autoNextTimer = setTimeout(() => this._advanceToNext(), 1000)
      },
    })
  },

  _advanceToNext() {
    const nextIndex = this.data.currentSentenceIndex + 1
    if (nextIndex >= this.data.sentences.length) {
      this._submitAssessment(false)
    } else {
      this.setData({ currentSentenceIndex: nextIndex, feedback: null, playing: false })
      this._playCurrentSentence()
    }
  },

  async _submitAssessment(skipped) {
    try {
      if (!isLoggedIn()) await login()
      const res = await request({
        url: '/assessment/submit',
        method: 'POST',
        data: {
          selfReportedLevel: this.data.selfReportedLevel,
          results: skipped ? [] : this.data.assessmentResults,
          skipped,
        },
      })
      this.setData({ assessmentResponse: res, step: 4 })
    } catch (err) {
      console.error('提交测评失败', err)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    }
  },

  onStartPractice() {
    const { assessmentResponse } = this.data
    const firstMaterial = assessmentResponse && assessmentResponse.recommendedMaterials && assessmentResponse.recommendedMaterials[0]
    wx.setStorageSync('onboardingDone', true)
    if (firstMaterial) {
      wx.redirectTo({
        url: `/pages/practice/practice?materialId=${firstMaterial.id}&materialTitle=${encodeURIComponent(firstMaterial.title)}`,
      })
    } else {
      wx.switchTab({ url: '/pages/materials/materials' })
    }
  },

  onGoToMaterials() {
    wx.setStorageSync('onboardingDone', true)
    wx.switchTab({ url: '/pages/materials/materials' })
  },
})