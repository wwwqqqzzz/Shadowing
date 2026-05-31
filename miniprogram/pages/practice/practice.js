const { getMockMaterial } = require('../../mock/data')
const { getMaterial, getSentences, createPracticeRecord } = require('../../utils/api')

const WAIT_MS = 2500
const SPEEDS = [0.5, 0.8, 1, 1.25, 1.5, 2]

Page({
  data: {
    material: null,
    sentences: [],
    currentIndex: 0,
    status: '',
    playing: false,
    speed: 1,
    loop: false,
    recording: false,
    recordPath: null,
    playingBack: false,
    feedback: null,
    showFeedback: false
  },

  async onLoad(options) {
    this._currentAudio = null
    this._waitTimer = null
    this._sentenceTimer = null
    this._timeUpdateInterval = null
    this._sentenceStartTime = null
    this._pausedAt = null
    this._audioCacheKey = Date.now()

    this.recorder = wx.getRecorderManager()
    this.recorder.onStart(() => {
      this.setData({ recording: true })
    })
    this.recorder.onStop((res) => {
      this.setData({ recording: false, recordPath: res.tempFilePath })
      this._evaluateRecording(res.tempFilePath)
    })
    this.recorder.onError((err) => {
      console.error('录音错误', err)
      this.setData({ recording: false })
    })

    const materialId = options.materialId

    if (!materialId) {
      wx.showToast({ title: '素材不存在', icon: 'error' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    try {
      const [material, sentences] = await Promise.all([
        getMaterial(materialId),
        getSentences(materialId),
      ])
      console.log('[onLoad] material.audioUrl=', material.audioUrl, 'material.audioOffsetMs=', material.audioOffsetMs)
      console.log('[onLoad] sentences count=', sentences.length, 'first audioUrl=', sentences[0] && sentences[0].audioUrl, 'first text=', sentences[0] && sentences[0].text && sentences[0].text.substring(0, 30))
      this.setData({ material, sentences })
    } catch (err) {
      console.error('拉取失败，降级到本地 mock', err)
      const fallback = getMockMaterial('mock-001')
      this.setData({
        material: { audioUrl: fallback.audioUrl, title: fallback.title, audioOffsetMs: fallback.audioOffsetMs || 0 },
        sentences: fallback.sentences,
      })
    }
  },

  onUnload() {
    this._clearWait()
    this._clearSentenceTimer()
    this._clearTimeUpdateInterval()
    this.recorder.stop()
    this._destroyAudio()
    this._destroyPlayback()
  },

  // ─── Destroy audio context ─────────────────────────────

  _clearTimeUpdateInterval() {
    if (this._timeUpdateInterval) {
      clearInterval(this._timeUpdateInterval)
      this._timeUpdateInterval = null
    }
  },

  _destroyAudio() {
    this._clearSentenceTimer()
    this._clearTimeUpdateInterval()
    if (this._currentAudio) {
      this._currentAudio.stop()
      this._currentAudio.destroy()
      this._currentAudio = null
    }
  },

  // ─── Sentence ended ────────────────────────────────────

  _onSentenceEnd() {
    const sentence = this.data.sentences[this.data.currentIndex]
    if (sentence) {
      createPracticeRecord({
        sentenceId: sentence.id,
        durationMs: sentence.endTime - sentence.startTime,
      })
    }

    this._destroyAudio()
    this.setData({ playing: false })

    const isLast = this.data.currentIndex >= this.data.sentences.length - 1

    if (isLast) {
      this.setData({ status: 'finished' })
      return
    }

    if (this.data.loop) {
      setTimeout(() => { this._playSentence(this.data.currentIndex) }, 400)
      return
    }

    this.setData({ status: 'waiting' })
    this._waitTimer = setTimeout(() => {
      this._goNext()
    }, WAIT_MS)
  },

  // ─── Play sentence at index ────────────────────────────

  _playSentence(index) {
    this._clearWait()
    this._destroyAudio()
    this._sentenceEndGuard = false
    const sentence = this.data.sentences[index]
    if (!sentence) return

    console.log('[_playSentence] index=', index, 'audioUrl=', sentence.audioUrl, 'startTime=', sentence.startTime)

    const ac = wx.createInnerAudioContext()
    ac.obeyMuteSwitch = false
    ac.playbackRate = this.data.speed

    const resolveUrl = (url) => {
      if (!url) return null
      if (url.startsWith('http://') || url.startsWith('https://')) return url
      if (url.startsWith('wxfile://')) return url
      if (url.startsWith('/')) return url
      return 'http://localhost:3000/audio/' + url
    }

    const offsetMs = (this.data.material && this.data.material.audioOffsetMs) || 0
    const durationMs = sentence.endTime - sentence.startTime
    let ended = false

    const triggerEnd = () => {
      if (ended) return
      ended = true
      if (this._sentenceEndGuard) return
      this._sentenceEndGuard = true
      this._clearSentenceTimer()
      this._onSentenceEnd()
    }

    ac.onEnded(() => {
      this._clearSentenceTimer()
      triggerEnd()
    })
    ac.onError((res) => {
      console.error('播放错误', res)
      this._clearSentenceTimer()
    })

    const doPlay = (srcPath) => {
      if (ended) return
      ac.src = srcPath
      ac.play()
      this._currentAudio = ac
      this._sentenceStartTime = Date.now()
      this.setData({ playing: true, currentIndex: index, status: 'playing' })
    }

    if (sentence.audioUrl) {
      // Per-sentence file: download to local, then play
      const remoteUrl = resolveUrl(sentence.audioUrl)
      console.log('[_playSentence] MODE: download + play, url=', remoteUrl)
      wx.downloadFile({
        url: remoteUrl,
        success: (res) => {
          if (res.statusCode === 200) {
            console.log('[_playSentence] downloaded, local path=', res.tempFilePath)
            doPlay(res.tempFilePath)
          } else {
            console.error('下载失败, status=', res.statusCode)
            triggerEnd()
          }
        },
        fail: (err) => {
          console.error('下载失败', err)
          triggerEnd()
        }
      })
    } else if (this.data.material && this.data.material.audioUrl) {
      // Seek mode: play full audio from remote with startTime
      const seekSec = (sentence.startTime + offsetMs) / 1000
      const remoteUrl = resolveUrl(this.data.material.audioUrl)
      console.log('[_playSentence] MODE: remote seek, url=', remoteUrl, 'seekSec=', seekSec)

      ac.onPlay(() => {
        if (ended) return
        if (this._currentAudio !== ac) return
        if (ac.currentTime < seekSec - 0.5) { ac.seek(seekSec) }
        this._sentenceStartTime = Date.now()
        this._startSentenceTimer(durationMs / this.data.speed + 200)
      })
      // Poll currentTime every 100ms — more reliable than onTimeUpdate on WeChat
      this._clearTimeUpdateInterval()
      this._timeUpdateInterval = setInterval(() => {
        if (ended) return
        if (this._currentAudio !== ac) return
        try {
          if (ac.currentTime >= (sentence.endTime + offsetMs) / 1000 - 0.05) { triggerEnd() }
        } catch (e) { /* currentTime access may throw on some WeChat versions */ }
      }, 100)
      // 必须先设 src，再设 startTime，最后 play()（设 src 会重置 startTime）
      if (ended) return
      ac.src = remoteUrl
      ac.startTime = seekSec
      ac.play()
      this._currentAudio = ac
      this._sentenceStartTime = Date.now()
      this.setData({ playing: true, currentIndex: index, status: 'playing' })
    }
  },

  _startSentenceTimer(listenMs) {
    this._clearSentenceTimer()
    this._sentenceTimer = setTimeout(() => {
      if (this._sentenceEndGuard) return
      this._sentenceEndGuard = true
      this._destroyAudio()
      this._onSentenceEnd()
    }, listenMs)
  },

  _clearSentenceTimer() {
    if (this._sentenceTimer) {
      clearTimeout(this._sentenceTimer)
      this._sentenceTimer = null
    }
  },

  // ─── Clear wait timer ──────────────────────────────────

  _clearWait() {
    if (this._waitTimer) {
      clearTimeout(this._waitTimer)
      this._waitTimer = null
    }
  },

  // ─── Advance to next sentence ──────────────────────────

  _goNext() {
    this._clearWait()
    this.setData({ recordPath: null, feedback: null, showFeedback: false })
    this._destroyPlayback()
    const next = this.data.currentIndex + 1
    if (next < this.data.sentences.length) {
      this._playSentence(next)
    }
  },

  // ─── User actions ──────────────────────────────────────

  onTogglePlay() {
    const { status, currentIndex } = this.data

    // Finished → restart from beginning
    if (status === 'finished') {
      this._playSentence(0)
      return
    }

    // Waiting → replay current sentence
    if (status === 'waiting') {
      this.setData({ recordPath: null })
      this._destroyPlayback()
      this._playSentence(currentIndex)
      return
    }

    // Playing → toggle audio
    if (this.data.playing) {
      if (this._currentAudio) {
        this._currentAudio.pause()
      }
      this._clearSentenceTimer()
      this._pausedAt = Date.now()
      this.setData({ playing: false })
    } else {
      if (this._currentAudio) {
        this._currentAudio.play()
        const sentence = this.data.sentences[this.data.currentIndex]
        if (sentence && this._sentenceStartTime && this._pausedAt && !sentence.audioUrl) {
          const elapsed = this._pausedAt - this._sentenceStartTime
          const total = (sentence.endTime - sentence.startTime) / this.data.speed
          const remaining = total - elapsed + 200
          if (remaining > 100) this._startSentenceTimer(remaining)
        }
      } else {
        this._playSentence(currentIndex)
      }
      this.setData({ playing: true, status: 'playing' })
    }
  },

  // Tap subtitle background → skip wait
  onTapSubtitleBg() {
    if (this.data.status === 'waiting') {
      this._goNext()
    }
  },

  onTapSentence(e) {
    this._clearWait()
    this.setData({ recordPath: null, feedback: null, showFeedback: false })
    this._destroyPlayback()
    const index = Number(e.currentTarget.dataset.index)
    this._playSentence(index)
  },

  onSkipPrev() {
    this._clearWait()
    this.setData({ recordPath: null, feedback: null, showFeedback: false })
    this._destroyAudio()
    this._destroyPlayback()
    const idx = Math.max(0, this.data.currentIndex - 1)
    this._playSentence(idx)
  },

  onSkipNext() {
    this._clearWait()
    this.setData({ recordPath: null, feedback: null, showFeedback: false })
    this._destroyAudio()
    this._destroyPlayback()
    const next = this.data.currentIndex + 1
    if (next >= this.data.sentences.length) {
      this.setData({ status: 'finished', playing: false })
      return
    }
    this._playSentence(next)
  },

  onSpeedChange() {
    const idx = SPEEDS.indexOf(this.data.speed)
    const next = SPEEDS[(idx + 1) % SPEEDS.length]
    if (this._currentAudio) {
      this._currentAudio.playbackRate = next
    }
    this.setData({ speed: next })
  },

  onLoop() {
    this.setData({ loop: !this.data.loop })
  },

  // ─── Recording ──────────────────────────────────────────

  onToggleRecord() {
    if (this.data.recording) {
      this.recorder.stop()
    } else {
      this._clearWait()
      const sentence = this.data.sentences[this.data.currentIndex]
      const sentenceLen = sentence ? sentence.endTime - sentence.startTime : 8000
      // 录音时长 = 句子时长 + 2s 缓冲，不低于 8s，不超过 30s
      const recordDuration = Math.min(Math.max(sentenceLen + 2000, 8000), 30000)
      this.recorder.start({
        format: 'mp3',
        sampleRate: 16000,
        numberOfChannels: 1,
        duration: recordDuration
      })
    }
  },

  onPlayback() {
    if (!this.data.recordPath) return
    this._destroyPlayback()
    const ac = wx.createInnerAudioContext()
    ac.obeyMuteSwitch = false
    ac.src = this.data.recordPath
    ac.onPlay(() => {
      this.setData({ playingBack: true })
    })
    ac.onStop(() => {
      this.setData({ playingBack: false })
      ac.destroy()
    })
    ac.onEnded(() => {
      this.setData({ playingBack: false })
      ac.destroy()
    })
    ac.onError((res) => {
      console.error('回放错误', res)
      this.setData({ playingBack: false })
      ac.destroy()
    })
    this._playbackCtx = ac
    ac.play()
  },

  _destroyPlayback() {
    if (this._playbackCtx) {
      this._playbackCtx.stop()
      this._playbackCtx.destroy()
      this._playbackCtx = null
    }
    this.setData({ playingBack: false })
  },

  _evaluateRecording(tempFilePath) {
    const sentence = this.data.sentences[this.data.currentIndex]
    if (!sentence) return

    wx.uploadFile({
      url: 'http://localhost:3000/api/asr/evaluate',
      filePath: tempFilePath,
      name: 'audio',
      formData: {
        sentenceId: sentence.id,
        language: 'en',
        originalText: sentence.text,
      },
      success: (res) => {
        const result = JSON.parse(res.data)
        this.setData({ feedback: result, showFeedback: true })
      },
      fail: () => {
        console.warn('评估失败（静默）')
      },
    })
  }
})
