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
    playingBack: false
  },

  async onLoad(options) {
    this._currentAudio = null
    this._waitTimer = null

    this.recorder = wx.getRecorderManager()
    this.recorder.onStart(() => {
      this.setData({ recording: true })
    })
    this.recorder.onStop((res) => {
      this.setData({ recording: false, recordPath: res.tempFilePath })
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
      this.setData({ material, sentences })
    } catch (err) {
      console.error('拉取失败，降级到本地 mock', err)
      const fallback = getMockMaterial('mock-001')
      this.setData({
        material: { audioUrl: fallback.audioUrl, title: fallback.title },
        sentences: fallback.sentences,
      })
    }
  },

  onUnload() {
    this._clearWait()
    this.recorder.stop()
    this._destroyAudio()
    this._destroyPlayback()
  },

  // ─── Destroy audio context ─────────────────────────────

  _destroyAudio() {
    this._clearTimeUpdate()
    if (this._currentAudio) {
      this._currentAudio.stop()
      this._currentAudio.destroy()
      this._currentAudio = null
    }
  },

  _clearTimeUpdate() {
    if (this._currentAudio && this._timeUpdateHandler) {
      this._currentAudio.offTimeUpdate(this._timeUpdateHandler)
    }
    this._timeUpdateHandler = null
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
    const sentence = this.data.sentences[index]
    if (!sentence) return

    const ac = wx.createInnerAudioContext()
    ac.obeyMuteSwitch = false
    ac.playbackRate = this.data.speed

    const resolveAudio = (url) => {
      if (!url) return null
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('wxfile://')) return url
      if (url.startsWith('/')) return url
      return '/mock/audio/' + url
    }

    if (sentence.audioUrl) {
      ac.src = resolveAudio(sentence.audioUrl)
      ac.onEnded(() => { this._onSentenceEnd() })
    } else if (this.data.material && this.data.material.audioUrl) {
      ac.src = resolveAudio(this.data.material.audioUrl)
      ac.startTime = sentence.startTime / 1000

      this._sentenceEnded = false
      const onEnd = () => {
        if (this._sentenceEnded) return
        this._sentenceEnded = true
        this._onSentenceEnd()
      }

      const checkEnd = () => {
        if (ac.currentTime * 1000 >= sentence.endTime) {
          ac.stop()
          onEnd()
        }
      }
      ac.onTimeUpdate(checkEnd)
      ac.onEnded(onEnd)
      this._timeUpdateHandler = checkEnd
      this._endHandler = onEnd
    }

    ac.onError((res) => {
      console.error('播放错误', res)
    })
    ac.play()
    this._currentAudio = ac
    this.setData({ playing: true, currentIndex: index, status: 'playing' })
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
    this.setData({ recordPath: null })
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
      this.setData({ playing: false })
    } else {
      // Resume current audio or replay from beginning
      if (this._currentAudio) {
        this._currentAudio.play()
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
    this.setData({ recordPath: null })
    this._destroyPlayback()
    const index = Number(e.currentTarget.dataset.index)
    this._playSentence(index)
  },

  onSkipPrev() {
    this._clearWait()
    this.setData({ recordPath: null })
    this._destroyAudio()
    this._destroyPlayback()
    const idx = Math.max(0, this.data.currentIndex - 1)
    this._playSentence(idx)
  },

  onSkipNext() {
    this._clearWait()
    this.setData({ recordPath: null })
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
  }
})
