const { createPracticeRecord, getWrongCount } = require('../../utils/api')

Page({
  data: {
    items: [],
    currentIndex: 0,
    status: 'idle',
    feedback: null,
    elapsed: 0,
    startTotal: 0,
    endCount: 0,
    sessionResults: []
  },

  onLoad(options) {
    this._currentAudio = null
    this._timeUpdateInterval = null
    this._sentenceEndGuard = false
    this._sentenceStartTime = null
    this._recordTimer = null

    const app = getApp()
    const items = app.globalData.wrongItems || []
    const startIndex = parseInt(options.startIndex || '0')
    this.setData({ items, currentIndex: startIndex, startTotal: items.length })

    this.recorder = wx.getRecorderManager()
    this.recorder.onStart(() => {
      this.setData({ status: 'recording', elapsed: 0 })
      this._recordTimer = setInterval(() => {
        this.setData({ elapsed: this.data.elapsed + 1 })
      }, 1000)
    })
    this.recorder.onStop((res) => {
      if (this._recordTimer) { clearInterval(this._recordTimer); this._recordTimer = null }
      this.setData({ status: 'evaluated' })
      this._evaluateRecording(res.tempFilePath)
    })
    this.recorder.onError((err) => {
      console.error('录音错误', err)
      if (this._recordTimer) { clearInterval(this._recordTimer); this._recordTimer = null }
      this.setData({ status: 'idle' })
    })

    if (items.length > 0) {
      this._playCurrent()
    }
  },

  onUnload() {
    this._clearTimeUpdateInterval()
    if (this._recordTimer) { clearInterval(this._recordTimer); this._recordTimer = null }
    try { this.recorder.stop() } catch (e) { /* ignore */ }
    this._destroyAudio()
  },

  _clearTimeUpdateInterval() {
    if (this._timeUpdateInterval) {
      clearInterval(this._timeUpdateInterval)
      this._timeUpdateInterval = null
    }
  },

  _destroyAudio() {
    this._clearTimeUpdateInterval()
    if (this._currentAudio) {
      this._currentAudio.stop()
      this._currentAudio.destroy()
      this._currentAudio = null
    }
  },

  _playCurrent() {
    this._destroyAudio()
    this._sentenceEndGuard = false
    const item = this.data.items[this.data.currentIndex]
    if (!item) return

    const sentence = item.sentence
    const material = item.sentence.material || item.material
    const ac = wx.createInnerAudioContext()
    ac.obeyMuteSwitch = false
    ac.playbackRate = 1

    const resolveUrl = (url) => {
      if (!url) return null
      if (url.startsWith('http://') || url.startsWith('https://')) return url
      if (url.startsWith('wxfile://')) return url
      if (url.startsWith('/')) return url
      return 'http://localhost:3000/audio/' + url
    }

    const offsetMs = (material && material.audioOffsetMs) || 0
    const durationMs = sentence.endTime - sentence.startTime
    let ended = false

    const triggerEnd = () => {
      if (ended) return
      ended = true
      if (this._sentenceEndGuard) return
      this._sentenceEndGuard = true
      this._clearTimeUpdateInterval()
      this._onSentenceEnd()
    }

    ac.onEnded(() => {
      this._clearTimeUpdateInterval()
      triggerEnd()
    })
    ac.onError((res) => {
      console.error('播放错误', res)
      this._clearTimeUpdateInterval()
    })

    if (sentence.audioUrl) {
        const remoteUrl = resolveUrl(sentence.audioUrl)
      wx.downloadFile({
        url: remoteUrl,
        success: (res) => {
          if (res.statusCode === 200) {
            ac.src = res.tempFilePath
            ac.play()
            this._currentAudio = ac
            this._sentenceStartTime = Date.now()
            this.setData({ status: 'playing' })
          } else {
            triggerEnd()
          }
        },
        fail: () => { triggerEnd() }
      })
    } else if (material && material.audioUrl) {
      const seekSec = (sentence.startTime + offsetMs) / 1000
      const remoteUrl = resolveUrl(material.audioUrl)

      ac.onPlay(() => {
        if (ended) return
        if (this._currentAudio !== ac) return
        if (ac.currentTime < seekSec - 0.5) { ac.seek(seekSec) }
        this._sentenceStartTime = Date.now()
      })

      this._clearTimeUpdateInterval()
      this._timeUpdateInterval = setInterval(() => {
        if (ended) return
        if (this._currentAudio !== ac) return
        try {
          if (ac.currentTime >= (sentence.endTime + offsetMs) / 1000 - 0.05) { triggerEnd() }
        } catch (e) { /* currentTime access may throw */ }
      }, 100)

      ac.src = remoteUrl
      ac.startTime = seekSec
      ac.play()
      this._currentAudio = ac
      this._sentenceStartTime = Date.now()
      this.setData({ status: 'playing' })
    }
  },

  _onSentenceEnd() {
    this._destroyAudio()

    const item = this.data.items[this.data.currentIndex]
    if (item) {
      createPracticeRecord({
        sentenceId: item.sentenceId,
        durationMs: item.sentence.endTime - item.sentence.startTime,
      })
    }

    const sentence = item ? item.sentence : null
    const sentenceLen = sentence ? sentence.endTime - sentence.startTime : 8000
    const recordDuration = Math.min(Math.max(sentenceLen + 2000, 8000), 30000)

    setTimeout(() => {
      this.recorder.start({
        format: 'mp3',
        sampleRate: 16000,
        numberOfChannels: 1,
        duration: recordDuration
      })

      this._autoStopTimer = setTimeout(() => {
        try { this.recorder.stop() } catch (e) { /* ignore */ }
      }, recordDuration + 500)
    }, 800)
  },

  onTogglePlay() {
    if (this.data.status === 'playing') {
      if (this._currentAudio) { this._currentAudio.pause() }
      this.setData({ status: 'idle' })
    } else {
      if (this._currentAudio) {
        this._currentAudio.play()
        this.setData({ status: 'playing' })
      } else {
        this._playCurrent()
      }
    }
  },

  _evaluateRecording(tempFilePath) {
    const item = this.data.items[this.data.currentIndex]
    if (!item) return

    const sentence = item.sentence
    wx.uploadFile({
      url: 'http://localhost:3000/api/asr/evaluate',
      filePath: tempFilePath,
      name: 'audio',
      formData: {
        sentenceId: item.sentenceId,
        language: 'en',
        originalText: sentence.text,
      },
      success: (res) => {
        const result = JSON.parse(res.data)
        const results = this.data.sessionResults.concat([{ sentenceId: item.sentenceId, score: result.score }])
        this.setData({ feedback: result, sessionResults: results })
      },
      fail: () => {
        console.warn('评估失败')
        this.setData({ feedback: { score: 0, recognizedText: '', errorWords: '' } })
      },
    })
  },

  onRetry() {
    if (this._autoStopTimer) { clearTimeout(this._autoStopTimer); this._autoStopTimer = null }
    this.setData({ feedback: null, status: 'idle', elapsed: 0 })
    this._playCurrent()
  },

  onNext() {
    if (this._autoStopTimer) { clearTimeout(this._autoStopTimer); this._autoStopTimer = null }
    const next = this.data.currentIndex + 1
    if (next >= this.data.items.length) {
      this._finishSession()
    } else {
      this.setData({ currentIndex: next, feedback: null, status: 'idle', elapsed: 0 })
      this._playCurrent()
    }
  },

  async _finishSession() {
    this._destroyAudio()
    let avgScore = 0
    const results = this.data.sessionResults
    if (results.length > 0) {
      avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    }
    try {
      const wrongData = await getWrongCount()
      const removed = this.data.startTotal - (wrongData.count || 0)
      this.setData({ endCount: wrongData.count || 0, removed, avgScore, status: 'finished' })
    } catch (err) {
      console.error('获取错题数失败', err)
      this.setData({ endCount: this.data.startTotal, removed: 0, avgScore, status: 'finished' })
    }
  },

  onReviewAgain() {
    this.setData({ currentIndex: 0, feedback: null, status: 'idle', elapsed: 0, sessionResults: [], endCount: 0 })
    this._playCurrent()
  },

  onBackToBook() {
    wx.navigateBack()
  }
})