const { getMockMaterial } = require('../../mock/data')
const { getMaterial, getSentences, createPracticeRecord, saveProgress, getPronounce } = require('../../utils/api')
const { isLoggedIn, login } = require('../../utils/auth')
const { formatDuration } = require('../../utils/format')

const DEFAULT_WAIT_MS = 2500
const SPEEDS = [0.5, 0.8, 1, 1.25, 1.5, 2]

Page({
  data: {
    materialId: '',
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
    showFeedback: false,
    showModeModal: false,
    practiceMode: 'free',
    practiceStartTime: 0,
    sessionScores: [],
    finishedData: null,
    waitMs: DEFAULT_WAIT_MS,
    wordDisplayData: [],
    currentWords: [],
    currentWordIndex: -1,
    pronouncingWord: '',
    pronouncingIpa: '',
    // ─── Shadow mode state ──────────────────────────────
    echoEnabled: false,
    shadowRecordings: [],
    shadowCompletePlaying: false,
    shadowCompleteSource: null,
    shadowPlayIndex: 0,
    modeModes: [
      { key: 'free', icon: '', name: '自由模式', desc: '播完自动进下一句，不录音，适合通勤听' },
      { key: 'auto', icon: '', name: '自动录音', desc: '播完自动录音评分，适合认真练习' },
      { key: 'manual', icon: '', name: '手动模式', desc: '自己控制录音和继续，适合反复练某句' },
      { key: 'shadow', icon: '', name: '影子跟读', desc: '原音与跟读同时进行，练节奏与流利度，无评分' },
    ]
  },

  async onLoad(options) {
    this._currentAudio = null
    this._waitTimer = null
    this._sentenceTimer = null
    this._timeUpdateInterval = null
    this._sentenceStartTime = null
    this._pausedAt = null
    this._audioCacheKey = Date.now()
    this._autoNextTimer = null
    this._pronounceCache = {}
    this._wordHighlightInterval = null
    this._currentWordTimings = null
    this._pendingShadowSave = false
    this._shadowPlaybackCtx = null
    this._shadowPlayQueue = []
    this._shadowShadowStopTimer = null
    this.setData({ practiceStartTime: Date.now() })

    const storedMode = wx.getStorageSync('practiceMode')
    if (storedMode) {
      this.data.practiceMode = storedMode
    }

    const storedWait = wx.getStorageSync('waitMs')
    if (storedWait) {
      this.data.waitMs = storedWait
    }

    this.recorder = wx.getRecorderManager()
    this.recorder.onStart(() => {
      this.setData({ recording: true })
    })
    this.recorder.onStop((res) => {
      this.setData({ recording: false, recordPath: res.tempFilePath })
      if (this._pendingShadowSave) {
        this._pendingShadowSave = false
        this._saveShadowRecording(res.tempFilePath, res.duration)
      } else {
        this._evaluateRecording(res.tempFilePath)
      }
    })
    this.recorder.onError((err) => {
      console.error('录音错误', err)
      this.setData({ recording: false })
      if (this._pendingShadowSave) {
        this._pendingShadowSave = false
        this._handleShadowRecordError(err)
      }
    })

    if (!isLoggedIn()) {
      try {
        await login()
      } catch (err) {
        wx.showToast({ title: '登录失败，训练记录将不会保存', icon: 'none', duration: 3000 })
      }
    }

    const mode = wx.getStorageSync('practiceMode')
    if (!mode) {
      this.setData({ showModeModal: true })
    } else {
      this.setData({ practiceMode: mode })
    }

    const materialId = options.materialId
    const startOrder = parseInt(options.startOrder || '1', 10)

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
      const startIndex = Math.max(0, sentences.findIndex(s => s.order >= startOrder))
      this.setData({ materialId, material, sentences, currentIndex: startIndex > 0 ? startIndex : 0 })
    } catch (err) {
      console.error('拉取失败，降级到本地 mock', err)
      const fallback = getMockMaterial('mock-001')
      const fallbackStart = Math.max(0, fallback.sentences.findIndex(s => s.order >= startOrder))
      this.setData({
        material: { audioUrl: fallback.audioUrl, title: fallback.title, audioOffsetMs: fallback.audioOffsetMs || 0 },
        sentences: fallback.sentences,
        currentIndex: fallbackStart > 0 ? fallbackStart : 0,
      })
    }
  },

  onUnload() {
    this._clearWait()
    this._clearSentenceTimer()
    this._clearTimeUpdateInterval()
    if (this._autoNextTimer) { clearTimeout(this._autoNextTimer); this._autoNextTimer = null }
    if (this._feedbackTimeout) { clearTimeout(this._feedbackTimeout); this._feedbackTimeout = null }
    this._destroyShadowPlayback()
    this._stopCompletePlayback()
    this.recorder.stop()
    this._destroyAudio()
    this._destroyPlayback()
    this._cleanupShadowFiles()
    this._saveCurrentProgress()
  },

  onHide() {
    this._saveCurrentProgress()
  },

  _saveCurrentProgress() {
    const { materialId, sentences, currentIndex } = this.data
    if (!materialId || !sentences || !sentences.length) return
    const currentOrder = sentences[currentIndex] && sentences[currentIndex].order
    if (currentOrder) {
      saveProgress(materialId, currentOrder, sentences.length)
    }
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
    this._clearWordHighlightInterval()
    if (this._currentAudio) {
      this._currentAudio.stop()
      this._currentAudio.destroy()
      this._currentAudio = null
    }
  },

  // ─── Sentence ended ────────────────────────────────────

  _onSentenceEnd() {
    const sentence = this.data.sentences[this.data.currentIndex]
    const mode = this.data.practiceMode

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
      saveProgress(this.data.materialId, 1, this.data.sentences.length)
      const durationMs = Date.now() - this.data.practiceStartTime
      const scores = this.data.sessionScores
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null
      this.setData({
        status: 'finished',
        finishedData: {
          title: (this.data.material && this.data.material.title) || '',
          total: this.data.sentences.length,
          durationText: formatDuration(durationMs),
          avgScore,
          showScore: this.data.practiceMode === 'auto' && avgScore != null,
        },
      })
      return
    }

    if (this.data.loop) {
      setTimeout(() => { this._playSentence(this.data.currentIndex) }, 400)
      return
    }

    if (mode === 'free') {
      this._clearWait()
      this._waitTimer = setTimeout(() => { this._goNext() }, this.data.waitMs)
      return
    }

    if (mode === 'auto') {
      this.setData({ status: 'waiting' })
      this._clearWait()
      this._waitTimer = setTimeout(() => {
        this.onToggleRecord()
        const sentenceLen = sentence ? sentence.endTime - sentence.startTime : 8000
        const recordDuration = Math.min(Math.max(sentenceLen + 2000, 8000), 30000)
        this._autoNextTimer = setTimeout(() => {
          if (this.data.recording) {
            this.recorder.stop()
          }
          // 评分回来后 _evaluateRecords 会触发 _scheduleAutoNext
          // 兜底：5秒后如果评分没回来，强制下一句
          this._feedbackTimeout = setTimeout(() => { this._goNext() }, 5000)
        }, recordDuration + 500)
      }, 800)
      return
    }

    if (mode === 'shadow') {
      this._handleShadowSentenceEnd()
      return
    }

    this.setData({ status: 'waiting' })
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
      const currentWords = this._splitWords(sentence.text)
      const wordTimings = sentence.wordTimings || null
      this.setData({ playing: true, currentIndex: index, status: 'playing', currentWords, currentWordIndex: -1 })
      this._currentWordTimings = wordTimings
      this._startWordHighlight(sentence.startTime, offsetMs)
      this._prefetchPronunciations(currentWords)
      this._maybeStartShadowRecording(sentence, durationMs)
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
      const currentWords = this._splitWords(sentence.text)
      const wordTimings = sentence.wordTimings || null
      this.setData({ playing: true, currentIndex: index, status: 'playing', currentWords, currentWordIndex: -1 })
      this._currentWordTimings = wordTimings
      this._startWordHighlight(sentence.startTime, offsetMs)
      this._prefetchPronunciations(currentWords)
      this._maybeStartShadowRecording(sentence, durationMs)
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
    if (this._autoNextTimer) { clearTimeout(this._autoNextTimer); this._autoNextTimer = null }
    if (this._feedbackTimeout) { clearTimeout(this._feedbackTimeout); this._feedbackTimeout = null }
    this.setData({ recordPath: null, feedback: null, showFeedback: false, wordDisplayData: [], currentWords: [], currentWordIndex: -1 })
    this._destroyPlayback()
    const next = this.data.currentIndex + 1
    if (next < this.data.sentences.length) {
      this._playSentence(next)
    }
  },

  // ─── User actions ──────────────────────────────────────

  onTogglePlay() {
    const { status, currentIndex } = this.data

    if (status === 'finished') {
      return
    }

    if (this.data.practiceMode === 'shadow' && status === 'playing') {
      wx.showToast({ title: '影子跟读中不能暂停', icon: 'none' })
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
    this.setData({ recordPath: null, feedback: null, showFeedback: false, wordDisplayData: [], currentWords: [], currentWordIndex: -1 })
    this._destroyPlayback()
    const index = Number(e.currentTarget.dataset.index)
    this._playSentence(index)
  },

  onSkipPrev() {
    this._clearWait()
    this._destroyShadowPlayback()
    this.setData({ recordPath: null, feedback: null, showFeedback: false, wordDisplayData: [], currentWords: [], currentWordIndex: -1 })
    this._destroyAudio()
    this._destroyPlayback()
    const idx = Math.max(0, this.data.currentIndex - 1)
    this._playSentence(idx)
  },

  onSkipNext() {
    this._clearWait()
    this._destroyShadowPlayback()
    this.setData({ recordPath: null, feedback: null, showFeedback: false, wordDisplayData: [], currentWords: [], currentWordIndex: -1 })
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

  onTapRestart() {
    this.setData({
      currentIndex: 0,
      status: 'idle',
      sessionScores: [],
      practiceStartTime: Date.now(),
      finishedData: null,
    })
    saveProgress(this.data.materialId, 1, this.data.sentences.length)
    this._playSentence(0)
  },

  onTapBack() {
    wx.navigateBack()
  },

  // ─── Shadow mode ────────────────────────────────────────

  _maybeStartShadowRecording(sentence, durationMs) {
    if (this.data.practiceMode !== 'shadow') return
    if (this.data.recording) return
    const sentenceLen = durationMs || (sentence.endTime - sentence.startTime) || 8000
    const recordDuration = Math.min(Math.max(sentenceLen + 2000, 3000), 60000)
    this._pendingShadowSave = true
    try {
      this.recorder.start({
        format: 'mp3',
        sampleRate: 16000,
        numberOfChannels: 1,
        duration: recordDuration,
      })
    } catch (e) {
      console.error('[shadow] recorder.start 失败', e)
      this._pendingShadowSave = false
      this._handleShadowRecordError(e)
    }
  },

  _saveShadowRecording(tempFilePath, durationMs) {
    const sentence = this.data.sentences[this.data.currentIndex]
    if (!sentence) return
    const cleanedRecordings = this.data.shadowRecordings.filter(
      r => r.sentenceOrder !== sentence.order
    )
    const entry = {
      sentenceOrder: sentence.order,
      filePath: tempFilePath,
      durationMs: durationMs || 0,
      hasAudio: true,
    }
    this.setData({ shadowRecordings: [...cleanedRecordings, entry] })
    console.log('[shadow] saved recording for sentence', sentence.order, 'durationMs=', durationMs)
  },

  _handleShadowRecordError(err) {
    const sentence = this.data.sentences[this.data.currentIndex]
    if (!sentence) return
    const cleanedRecordings = this.data.shadowRecordings.filter(
      r => r.sentenceOrder !== sentence.order
    )
    this.setData({
      shadowRecordings: [...cleanedRecordings, {
        sentenceOrder: sentence.order,
        filePath: null,
        durationMs: 0,
        hasAudio: false,
      }],
    })
    console.warn('[shadow] 录音失败 (sentence', sentence.order, ')', err)
  },

  _handleShadowSentenceEnd() {
    const isLast = this.data.currentIndex >= this.data.sentences.length - 1
    if (isLast) {
      setTimeout(() => this._goToFinished(), 600)
      return
    }
    if (this.data.echoEnabled) {
      this._playShadowEchoPlayback()
    } else {
      this._goNext()
    }
  },

  _goToFinished() {
    saveProgress(this.data.materialId, 1, this.data.sentences.length)
    const durationMs = Date.now() - this.data.practiceStartTime
    const totalRecordings = this.data.shadowRecordings.length
    const withAudio = this.data.shadowRecordings.filter(r => r.hasAudio).length
    this.setData({
      status: 'finished',
      finishedData: {
        title: (this.data.material && this.data.material.title) || '',
        total: this.data.sentences.length,
        durationText: formatDuration(durationMs),
        showScore: false,
        shadowMode: true,
        shadowRecordings: this.data.shadowRecordings,
        shadowWithAudio: withAudio,
        shadowTotal: totalRecordings,
      },
    })
  },

  _playShadowEchoPlayback() {
    const current = this.data.shadowRecordings.find(
      r => r.sentenceOrder === this.data.sentences[this.data.currentIndex].order
    )
    if (!current || !current.hasAudio || !current.filePath) {
      this._goNext()
      return
    }
    this._destroyShadowPlayback()
    const ac = wx.createInnerAudioContext()
    ac.obeyMuteSwitch = false
    ac.src = current.filePath
    ac.onEnded(() => {
      this._destroyShadowPlayback()
      this._goNext()
    })
    ac.onError((err) => {
      console.error('[shadow] 回放出错', err)
      this._destroyShadowPlayback()
      this._goNext()
    })
    this._shadowPlaybackCtx = ac
    this.setData({ playingBack: true })
    ac.play()
  },

  _destroyShadowPlayback() {
    if (this._shadowPlaybackCtx) {
      try { this._shadowPlaybackCtx.stop() } catch (e) {}
      try { this._shadowPlaybackCtx.destroy() } catch (e) {}
      this._shadowPlaybackCtx = null
    }
    this.setData({ playingBack: false })
  },

  onSkipShadowPlayback() {
    this._destroyShadowPlayback()
    this._goNext()
  },

  onToggleEcho() {
    if (this.data.shadowCompletePlaying) {
      wx.showToast({ title: '回放中无法切换', icon: 'none' })
      return
    }
    this.setData({ echoEnabled: !this.data.echoEnabled })
  },

  _playCompleteShadow() {
    const valid = this.data.shadowRecordings.filter(r => r.hasAudio && r.filePath)
    if (valid.length === 0) {
      wx.showToast({ title: '没有可回放的录音', icon: 'none' })
      return
    }
    this._shadowPlayQueue = valid.map(r => ({ filePath: r.filePath, kind: 'self' }))
    this.setData({
      shadowCompletePlaying: true,
      shadowCompleteSource: 'self',
      shadowPlayIndex: 0,
    })
    this._playShadowQueueNext()
  },

  _playCompleteOriginal() {
    if (!this.data.material || !this.data.material.audioUrl) {
      wx.showToast({ title: '原音不可用', icon: 'none' })
      return
    }
    this._destroyShadowPlayback()
    this._destroyAudio()
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
    const remoteUrl = resolveUrl(this.data.material.audioUrl)
    ac.src = remoteUrl
    this._shadowPlaybackCtx = ac
    this.setData({
      shadowCompletePlaying: true,
      shadowCompleteSource: 'original',
      shadowPlayIndex: 0,
    })
    ac.onEnded(() => {
      this._stopCompletePlayback()
    })
    ac.onError((err) => {
      console.error('[shadow] 原音回放出错', err)
      this._stopCompletePlayback()
    })
    ac.play()
  },

  _playShadowQueueNext() {
    if (this._shadowPlayQueue.length === 0) {
      this._stopCompletePlayback()
      return
    }
    const next = this._shadowPlayQueue.shift()
    this._destroyShadowPlayback()
    const ac = wx.createInnerAudioContext()
    ac.obeyMuteSwitch = false
    ac.src = next.filePath
    ac.onEnded(() => {
      this.setData({ shadowPlayIndex: this.data.shadowPlayIndex + 1 })
      this._playShadowQueueNext()
    })
    ac.onError((err) => {
      console.error('[shadow] 队列回放出错', err)
      this.setData({ shadowPlayIndex: this.data.shadowPlayIndex + 1 })
      this._playShadowQueueNext()
    })
    this._shadowPlaybackCtx = ac
    this.setData({ playingBack: true })
    ac.play()
  },

  onStopCompletePlayback() {
    this._stopCompletePlayback()
  },

  _stopCompletePlayback() {
    this._shadowPlayQueue = []
    this._destroyShadowPlayback()
    this.setData({
      shadowCompletePlaying: false,
      shadowCompleteSource: null,
      shadowPlayIndex: 0,
      playingBack: false,
    })
  },

  _cleanupShadowFiles() {
    const paths = this.data.shadowRecordings
      .filter(r => r.hasAudio && r.filePath)
      .map(r => r.filePath)
    if (paths.length === 0) return
    const fs = wx.getFileSystemManager()
    paths.forEach(p => {
      try {
        fs.removeSavedFile({ filePath: p })
      } catch (e) {
        console.warn('[shadow] 清理文件失败', p, e)
      }
    })
    console.log('[shadow] 清理录音文件', paths.length, '个')
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

  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    wx.setStorageSync('practiceMode', mode)
    this.setData({ showModeModal: false, practiceMode: mode })
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

    const { BASE_URL } = require('../../utils/request')
    wx.uploadFile({
      url: `${BASE_URL}/asr/evaluate`,
      filePath: tempFilePath,
      name: 'audio',
      formData: {
        sentenceId: sentence.id,
        language: 'en',
        originalText: sentence.text,
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.error('评估接口返回非 2xx', res.statusCode, res.data)
          this._handleEvalFailure(sentence, `服务器错误 ${res.statusCode}`)
          return
        }
        let result
        try {
          result = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        } catch (parseErr) {
          console.error('评估响应 JSON 解析失败', parseErr, res.data)
          this._handleEvalFailure(sentence, '响应格式错误')
          return
        }
        const wordResults = result.wordResults || []
        const wordDisplayData = wordResults.map((w) => ({
          word: w.word,
          status: w.status,
          recognized: w.recognized || '',
        }))
        this.setData({
          feedback: result,
          showFeedback: true,
          wordDisplayData,
        })
        if (this.data.practiceMode === 'auto' && result.score != null) {
          this.setData({ sessionScores: [...this.data.sessionScores, result.score] })
        }
        if (this.data.practiceMode === 'auto') {
          this._scheduleAutoNext(3000)
        }
      },
      fail: (err) => {
        console.error('录音评估网络失败', err)
        const errMsg = (err && (err.errMsg || err.message)) || '网络异常'
        this._handleEvalFailure(sentence, errMsg)
      },
    })
  },

  _handleEvalFailure(sentence, errMsg) {
    wx.showToast({
      title: `评估失败：${errMsg}`,
      icon: 'none',
      duration: 3000,
    })
    this.setData({
      showFeedback: true,
      feedback: {
        score: null,
        evalFailed: true,
        errorCount: 0,
        wordResults: [],
        missingWords: [],
        recognizedText: '',
        originalText: sentence ? sentence.text : '',
      },
      wordDisplayData: [],
    })
    if (this.data.practiceMode === 'auto') {
      this._scheduleAutoNext(4000)
    }
  },

  _scheduleAutoNext(delayMs) {
    if (this._feedbackTimeout) {
      clearTimeout(this._feedbackTimeout)
      this._feedbackTimeout = null
    }
    if (this._autoNextTimer) {
      clearTimeout(this._autoNextTimer)
      this._autoNextTimer = null
    }
    this._autoNextTimer = setTimeout(() => { this._goNext() }, delayMs)
  },

  _splitWords(text) {
    if (!text) return []
    return text.split(/\s+/).filter(w => w.length > 0).map((w, i) => ({
      word: w.replace(/[,.\!?;:'"]/g, ''),
      original: w,
      index: i,
    }))
  },

  _startWordHighlight(sentenceStartMs, offsetMs) {
    this._clearWordHighlightInterval()
    const timings = this._currentWordTimings
    if (!timings || timings.length === 0) return

    this._wordHighlightInterval = setInterval(() => {
      if (!this._currentAudio) return
      try {
        const currentTimeSec = this._currentAudio.currentTime
        const currentTimeMs = currentTimeSec * 1000 - (offsetMs || 0) - sentenceStartMs
        let idx = -1
        for (let i = 0; i < timings.length; i++) {
          if (currentTimeMs >= timings[i].start && currentTimeMs <= timings[i].end) {
            idx = i
            break
          }
        }
        if (idx !== this.data.currentWordIndex) {
          this.setData({ currentWordIndex: idx })
        }
      } catch (e) { /* ignore */ }
    }, 100)
  },

  _clearWordHighlightInterval() {
    if (this._wordHighlightInterval) {
      clearInterval(this._wordHighlightInterval)
      this._wordHighlightInterval = null
    }
  },

  onLongPressWord(e) {
    const word = e.currentTarget.dataset.word
    if (!word) return

    this.setData({ pronouncingWord: word })

    const cached = this._pronounceCache[word]
    if (cached) {
      this._playPronunciation(cached)
    } else {
      getPronounce(word).then(result => {
        this._pronounceCache[word] = result
        this._playPronunciation(result)
      }).catch(() => {
        this.setData({ pronouncingWord: '' })
      })
    }
  },

  _playPronunciation(result) {
    const word = result.word
    const ipa = result.ipa || result.ipaAlt || ''
    this.setData({ pronouncingWord: word, pronouncingIpa: ipa })

    if (result.audioUrl) {
      const ac = wx.createInnerAudioContext()
      ac.obeyMuteSwitch = false
      ac.src = result.audioUrl
      ac.onEnded(() => {
        this.setData({ pronouncingWord: '', pronouncingIpa: '' })
        ac.destroy()
      })
      ac.onError(() => {
        this.setData({ pronouncingWord: '', pronouncingIpa: '' })
        ac.destroy()
      })
      ac.play()
    } else {
      setTimeout(() => {
        this.setData({ pronouncingWord: '', pronouncingIpa: '' })
      }, 1500)
    }
  },

  _prefetchPronunciations(currentWords) {
    const uncached = currentWords.filter(w => !this._pronounceCache[w.word])
    if (uncached.length === 0) return
    uncached.forEach(w => {
      getPronounce(w.word).then(result => {
        this._pronounceCache[w.word] = result
      }).catch(() => {})
    })
  },
})
