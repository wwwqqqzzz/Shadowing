#!/usr/bin/env node
// Smoke test for v2.9.0 shadow mode logic.
// Mocks WeChat globals and exercises the critical code paths in practice.js
// to verify the 5 bug fixes (commits 8db0293 + e1dad98) hold.
// Does NOT replace the WeChat IDE test — the IDE test catches device-driver
// / file-system / actual-audio bugs. This catches: defer flag ordering,
// sentence attribution, queue mechanism, onError routing, recorder-already-
// stopped race.

const assert = require('assert')
const path = require('path')

const store = {}
const recorder = {
  _handlers: {},
  _started: false,
  onStart(fn) { this._handlers.onStart = fn },
  onStop(fn) { this._handlers.onStop = fn },
  onError(fn) { this._handlers.onError = fn },
  start(opts) {
    if (this._started) throw new Error('already_recording')
    this._started = true
    this._currentOpts = opts
    setImmediate(() => this._handlers.onStart && this._handlers.onStart())
  },
  stop() {
    if (!this._started) return
    this._started = false
    const duration = this._currentOpts ? this._currentOpts.duration : 5000
    setImmediate(() => this._handlers.onStop && this._handlers.onStop({
      tempFilePath: 'mock://recording-' + Date.now() + '.mp3',
      duration,
    }))
  },
}

global.wx = {
  getStorageSync(k) { return store[k] },
  setStorageSync(k, v) { store[k] = v },
  removeStorageSync(k) { delete store[k] },
  getRecorderManager() { recorder._started = false; recorder._handlers = {}; return recorder },
  createInnerAudioContext() {
    return {
      src: null, obeyMuteSwitch: false, playbackRate: 1, currentTime: 0,
      _handlers: {},
      on(n, f) { this._handlers[n] = f },
      play() {}, pause() {}, stop() {}, seek() {}, destroy() {},
      fireEnded() { this._handlers.onEnded && this._handlers.onEnded() },
    }
  },
  downloadFile: ({ success }) => setImmediate(() => success({
    statusCode: 200, tempFilePath: 'mock://downloaded.mp3',
  })),
  uploadFile: ({ success }) => setImmediate(() => success({
    statusCode: 200, data: JSON.stringify({ score: 90, wordResults: [] }),
  })),
  request: ({ success }) => setImmediate(() => success({ statusCode: 200, data: {} })),
  showToast: () => {},
  showModal: () => {},
  navigateBack: () => {},
  login: ({ success }) => setImmediate(() => success({ code: 'mock-code' })),
  getFileSystemManager: () => ({
    removeSavedFile: ({ success }) => success && setImmediate(success),
  }),
}

global.Page = (config) => { global._pageConfig = config }
global.getApp = () => ({ globalData: {} })

const practicePath = path.resolve(__dirname, '../miniprogram/pages/practice/practice.js')
delete require.cache[require.resolve(practicePath)]
require(practicePath)

const config = global._pageConfig
assert(config, 'Page() was not called')
assert(typeof config.onLoad === 'function', 'onLoad missing')
assert(typeof config._handleShadowSentenceEnd === 'function', '_handleShadowSentenceEnd missing')

const pageInstance = {
  data: JSON.parse(JSON.stringify(config.data)),
  setData(patch) { Object.assign(this.data, patch) },
  recorder,
  ...config,
}
pageInstance.recorder = recorder

function newSentence(order, text, startMs, endMs) {
  return { id: 's' + order, order, text, translation: '', startTime: startMs, endTime: endMs }
}

function resetPage(opts = {}) {
  pageInstance._startShadowRecording = config._startShadowRecording
  pageInstance._pendingShadowSave = false
  pageInstance._pendingNextShadowStart = null
  pageInstance._currentShadowSentence = null
  pageInstance._deferFinishedAfterStop = false
  pageInstance._deferEchoAfterStop = false
  pageInstance._deferAdvanceAfterStop = false
  pageInstance._shadowPlaybackCtx = null
  pageInstance._shadowPlayQueue = []
  recorder._started = false
  recorder._handlers = {}
  pageInstance.data.recording = false
  pageInstance.data.shadowRecordings = []
  pageInstance.data.practiceMode = opts.practiceMode || 'shadow'
}

function runOnStopChain(res) {
  pageInstance.setData({ recording: false, recordPath: res.tempFilePath })
  if (pageInstance._pendingShadowSave) {
    pageInstance._pendingShadowSave = false
    const targetSentence = pageInstance._currentShadowSentence
    pageInstance._currentShadowSentence = null
    pageInstance._saveShadowRecording(targetSentence, res.tempFilePath, res.duration)
  }
  if (pageInstance._pendingNextShadowStart) {
    const next = pageInstance._pendingNextShadowStart
    pageInstance._pendingNextShadowStart = null
    pageInstance._startShadowRecording(next.sentence, next.durationMs)
    return 'queue'
  }
  if (pageInstance._deferFinishedAfterStop) {
    pageInstance._deferFinishedAfterStop = false
    pageInstance._goToFinished()
    return 'finished'
  }
  if (pageInstance._deferEchoAfterStop) {
    pageInstance._deferEchoAfterStop = false
    pageInstance._playShadowEchoPlayback()
    return 'echo'
  }
  if (pageInstance._deferAdvanceAfterStop) {
    pageInstance._deferAdvanceAfterStop = false
    pageInstance._goNext()
    return 'advance'
  }
  return 'idle'
}

function runOnErrorChain(err) {
  pageInstance.setData({ recording: false })
  if (pageInstance._pendingShadowSave) {
    pageInstance._pendingShadowSave = false
    const targetSentence = pageInstance._currentShadowSentence
    pageInstance._currentShadowSentence = null
    pageInstance._handleShadowRecordError(targetSentence, err)
  }
  if (pageInstance._pendingNextShadowStart) {
    pageInstance._pendingNextShadowStart = null
  }
  if (pageInstance._deferFinishedAfterStop) {
    pageInstance._deferFinishedAfterStop = false
    pageInstance._goToFinished()
    return 'finished'
  } else if (pageInstance._deferEchoAfterStop) {
    pageInstance._deferEchoAfterStop = false
    pageInstance._playShadowEchoPlayback()
    return 'echo'
  } else if (pageInstance._deferAdvanceAfterStop) {
    pageInstance._deferAdvanceAfterStop = false
    pageInstance._goNext()
    return 'advance'
  }
  return 'idle'
}

;(async () => {
  let pass = 0, fail = 0
  async function t(name, fn) {
    try {
      await fn()
      console.log('  ✓ ' + name)
      pass++
    } catch (e) {
      console.log('  ✗ ' + name)
      console.log('    ' + (e.stack || e.message))
      fail++
    }
  }

  console.log('\n[1] Bug #1 fix: recordDuration = sentenceLen + 60s pause buffer')
  await t('5000ms sentence → recorder.duration = 65000', () => {
    resetPage()
    pageInstance._startShadowRecording(newSentence(1, 'a', 0, 5000), 5000)
    assert.strictEqual(recorder._currentOpts.duration, 65000)
  })
  await t('500ms sentence → recorder.duration = 60500 (min floor)', () => {
    resetPage()
    pageInstance._startShadowRecording(newSentence(1, 'a', 0, 500), 500)
    assert.strictEqual(recorder._currentOpts.duration, 60500)
  })
  await t('90000ms sentence → recorder.duration = 150000 (max cap)', () => {
    resetPage()
    pageInstance._startShadowRecording(newSentence(1, 'a', 0, 90000), 90000)
    assert.strictEqual(recorder._currentOpts.duration, 150000)
  })

  console.log('\n[2] Bug #1 fix: queue mechanism when recorder is busy')
  await t('busy recorder → queues _pendingNextShadowStart, does not start new', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance._maybeStartShadowRecording(newSentence(1, 'a', 0, 5000), 5000)
    assert.strictEqual(recorder._started, false)
    assert(pageInstance._pendingNextShadowStart)
    assert.strictEqual(pageInstance._pendingNextShadowStart.durationMs, 5000)
  })
  await t('idle recorder → starts new recording', () => {
    resetPage()
    pageInstance._maybeStartShadowRecording(newSentence(1, 'a', 0, 5000), 5000)
    assert.strictEqual(recorder._started, true)
  })

  console.log('\n[3] Bug #4 fix: _saveShadowRecording takes explicit sentence param')
  await t('attributed to given sentence order, not currentIndex', () => {
    resetPage()
    pageInstance._saveShadowRecording(newSentence(7, 'x', 0, 1000), 'mock://f.mp3', 1000)
    assert.strictEqual(pageInstance.data.shadowRecordings.length, 1)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 7)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].hasAudio, true)
  })
  await t('null sentence → no-op', () => {
    resetPage()
    pageInstance._saveShadowRecording(null, 'mock://f.mp3', 1000)
    assert.strictEqual(pageInstance.data.shadowRecordings.length, 0)
  })

  console.log('\n[4] Bug #4 fix: _handleShadowRecordError takes explicit sentence param')
  await t('error entry attributed to given sentence', () => {
    resetPage()
    pageInstance._handleShadowRecordError(newSentence(9, 'y', 0, 1000), { errMsg: 'mock' })
    assert.strictEqual(pageInstance.data.shadowRecordings.length, 1)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 9)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].hasAudio, false)
  })

  console.log('\n[5] Bug #2 fix: _deferEchoAfterStop flag (no direct call)')
  await t('echo=ON, not last, recording=true → sets flag', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance.data.echoEnabled = true
    pageInstance.data.currentIndex = 0
    pageInstance.data.sentences = [newSentence(1, 'a', 0, 5000), newSentence(2, 'b', 5000, 10000)]
    const ctxBefore = pageInstance._shadowPlaybackCtx
    pageInstance._handleShadowSentenceEnd()
    assert.strictEqual(pageInstance._deferEchoAfterStop, true)
    assert.strictEqual(pageInstance._deferAdvanceAfterStop, false)
    assert.strictEqual(pageInstance._shadowPlaybackCtx, ctxBefore, 'no playback created yet')
  })

  console.log('\n[6] Bug #3 fix: _deferFinishedAfterStop flag (no direct call)')
  await t('isLast, recording=true → sets flag, no advance/echo flag', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance.data.echoEnabled = false
    pageInstance.data.currentIndex = 1
    pageInstance.data.sentences = [newSentence(1, 'a', 0, 5000), newSentence(2, 'b', 5000, 10000)]
    pageInstance._handleShadowSentenceEnd()
    assert.strictEqual(pageInstance._deferFinishedAfterStop, true)
    assert.strictEqual(pageInstance._deferAdvanceAfterStop, false)
  })

  console.log('\n[7] isLast wins over echo=ON')
  await t('isLast && echoEnabled, recording=true → finished flag, NOT echo flag', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance.data.echoEnabled = true
    pageInstance.data.currentIndex = 1
    pageInstance.data.sentences = [newSentence(1, 'a', 0, 5000), newSentence(2, 'b', 5000, 10000)]
    pageInstance._handleShadowSentenceEnd()
    assert.strictEqual(pageInstance._deferFinishedAfterStop, true)
    assert.strictEqual(pageInstance._deferEchoAfterStop, false)
  })

  console.log('\n[8] Bug #5 fix: recorder-already-stopped race in _handleShadowSentenceEnd')
  await t('recorder done (data.recording=false), not last, echo=OFF → _goNext directly', () => {
    resetPage()
    pageInstance.data.recording = false
    pageInstance.data.echoEnabled = false
    pageInstance.data.currentIndex = 0
    pageInstance.data.sentences = [newSentence(1, 'a', 0, 5000), newSentence(2, 'b', 5000, 10000)]
    let goNextCalled = false
    pageInstance._goNext = () => { goNextCalled = true }
    pageInstance._handleShadowSentenceEnd()
    assert.strictEqual(goNextCalled, true)
    assert.strictEqual(pageInstance._deferAdvanceAfterStop, false)
  })
  await t('recorder done, isLast → _goToFinished directly', () => {
    resetPage()
    pageInstance.data.recording = false
    pageInstance.data.currentIndex = 1
    pageInstance.data.sentences = [newSentence(1, 'a', 0, 5000), newSentence(2, 'b', 5000, 10000)]
    let goToFinishedCalled = false
    pageInstance._goToFinished = () => { goToFinishedCalled = true }
    pageInstance._handleShadowSentenceEnd()
    assert.strictEqual(goToFinishedCalled, true)
    assert.strictEqual(pageInstance._deferFinishedAfterStop, false)
  })
  await t('recorder done, echo=ON, not last → _playShadowEchoPlayback directly', () => {
    resetPage()
    pageInstance.data.recording = false
    pageInstance.data.echoEnabled = true
    pageInstance.data.currentIndex = 0
    pageInstance.data.sentences = [newSentence(1, 'a', 0, 5000), newSentence(2, 'b', 5000, 10000)]
    let echoCalled = false
    pageInstance._playShadowEchoPlayback = () => { echoCalled = true }
    pageInstance._handleShadowSentenceEnd()
    assert.strictEqual(echoCalled, true)
    assert.strictEqual(pageInstance._deferEchoAfterStop, false)
  })

  console.log('\n[9] _clearShadowDeferFlags clears all flags + queue')
  await t('resets all 4 state vars', () => {
    resetPage()
    pageInstance._deferFinishedAfterStop = true
    pageInstance._deferEchoAfterStop = true
    pageInstance._deferAdvanceAfterStop = true
    pageInstance._pendingNextShadowStart = { sentence: {}, durationMs: 5000 }
    pageInstance._clearShadowDeferFlags()
    assert.strictEqual(pageInstance._deferFinishedAfterStop, false)
    assert.strictEqual(pageInstance._deferEchoAfterStop, false)
    assert.strictEqual(pageInstance._deferAdvanceAfterStop, false)
    assert.strictEqual(pageInstance._pendingNextShadowStart, null)
  })

  console.log('\n[10] Integration: onStop routes through flag chain')
  await t('_deferAdvanceAfterStop=true → save + _goNext', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance._pendingShadowSave = true
    pageInstance._currentShadowSentence = newSentence(1, 'a', 0, 5000)
    pageInstance._deferAdvanceAfterStop = true
    let goNextCalled = false
    pageInstance._goNext = () => { goNextCalled = true }
    const result = runOnStopChain({ tempFilePath: 'mock://r.mp3', duration: 5000 })
    assert.strictEqual(result, 'advance')
    assert.strictEqual(goNextCalled, true)
    assert.strictEqual(pageInstance.data.shadowRecordings.length, 1)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 1)
  })
  await t('_deferFinishedAfterStop=true → save + _goToFinished', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance._pendingShadowSave = true
    pageInstance._currentShadowSentence = newSentence(2, 'b', 5000, 10000)
    pageInstance._deferFinishedAfterStop = true
    let goToFinishedCalled = false
    pageInstance._goToFinished = () => { goToFinishedCalled = true }
    const result = runOnStopChain({ tempFilePath: 'mock://r.mp3', duration: 5000 })
    assert.strictEqual(result, 'finished')
    assert.strictEqual(goToFinishedCalled, true)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 2)
  })
  await t('_deferEchoAfterStop=true → save + _playShadowEchoPlayback', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance._pendingShadowSave = true
    pageInstance._currentShadowSentence = newSentence(1, 'a', 0, 5000)
    pageInstance._saveShadowRecording(newSentence(1, 'a', 0, 5000), 'mock://r.mp3', 5000)
    pageInstance._deferEchoAfterStop = true
    let echoCalled = false
    pageInstance._playShadowEchoPlayback = () => { echoCalled = true }
    const result = runOnStopChain({ tempFilePath: 'mock://r2.mp3', duration: 5000 })
    assert.strictEqual(result, 'echo')
    assert.strictEqual(echoCalled, true)
  })

  console.log('\n[11] Integration: queue consumes on next onStop')
  await t('busy recorder queue → onStop → start next sentence', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance._pendingShadowSave = true
    pageInstance._currentShadowSentence = newSentence(1, 'a', 0, 5000)
    const s2 = newSentence(2, 'b', 5000, 10000)
    pageInstance._pendingNextShadowStart = { sentence: s2, durationMs: 5000 }
    let startCalledWith = null
    pageInstance._startShadowRecording = (s, d) => { startCalledWith = { s, d } }
    const result = runOnStopChain({ tempFilePath: 'mock://r.mp3', duration: 5000 })
    assert.strictEqual(result, 'queue')
    assert.deepStrictEqual(startCalledWith, { s: s2, d: 5000 })
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 1)
  })

  console.log('\n[12] Integration: onError mirrors onStop flag chain')
  await t('onError with _deferFinishedAfterStop=true → save error + _goToFinished', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance._pendingShadowSave = true
    pageInstance._currentShadowSentence = newSentence(2, 'b', 5000, 10000)
    pageInstance._deferFinishedAfterStop = true
    let goToFinishedCalled = false
    pageInstance._goToFinished = () => { goToFinishedCalled = true }
    const result = runOnErrorChain({ errMsg: 'mock' })
    assert.strictEqual(result, 'finished')
    assert.strictEqual(goToFinishedCalled, true)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].hasAudio, false)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 2)
  })
  await t('onError with _deferAdvanceAfterStop=true → save error + _goNext', () => {
    resetPage()
    pageInstance.data.recording = true
    pageInstance._pendingShadowSave = true
    pageInstance._currentShadowSentence = newSentence(3, 'c', 10000, 15000)
    pageInstance._deferAdvanceAfterStop = true
    let goNextCalled = false
    pageInstance._goNext = () => { goNextCalled = true }
    const result = runOnErrorChain({ errMsg: 'mock' })
    assert.strictEqual(result, 'advance')
    assert.strictEqual(goNextCalled, true)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 3)
  })

  console.log('\n[13] Replay safety: identical inputs produce identical outputs')
  await t('5 replays of _saveShadowRecording all return same shape', () => {
    const s = newSentence(5, 'e', 0, 1000)
    for (let i = 0; i < 5; i++) {
      resetPage()
      pageInstance._saveShadowRecording(s, 'mock://f.mp3', 1000)
      assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 5)
    }
  })

  console.log('\n[14] _startShadowRecording sets _pendingShadowSave + snapshot sync')
  await t('_pendingShadowSave=true, _currentShadowSentence=s, recorder._started=true', () => {
    resetPage()
    const s = newSentence(1, 'a', 0, 5000)
    pageInstance._startShadowRecording(s, 5000)
    assert.strictEqual(pageInstance._pendingShadowSave, true)
    assert.strictEqual(pageInstance._currentShadowSentence, s)
    assert.strictEqual(recorder._started, true)
    assert.strictEqual(recorder._currentOpts.duration, 65000)
  })

  console.log('\n[15] runOnStopChain after _startShadowRecording → recording saved')
  await t('save: shadowRecordings[0] has correct sentenceOrder, hasAudio=true, snapshot cleared', () => {
    resetPage()
    const s = newSentence(11, 'k', 0, 5000)
    pageInstance._startShadowRecording(s, 5000)
    assert.strictEqual(pageInstance._currentShadowSentence, s)
    runOnStopChain({ tempFilePath: 'mock://r.mp3', duration: 5000 })
    assert.strictEqual(pageInstance.data.shadowRecordings.length, 1)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 11)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].hasAudio, true)
    assert.strictEqual(pageInstance._currentShadowSentence, null, 'snapshot cleared after save')
  })

  console.log('\n[16] runOnErrorChain after _startShadowRecording → error entry recorded')
  await t('error: shadowRecordings[0].hasAudio=false, snapshot cleared', () => {
    resetPage()
    const s = newSentence(12, 'l', 0, 5000)
    pageInstance._startShadowRecording(s, 5000)
    assert.strictEqual(pageInstance._currentShadowSentence, s)
    runOnErrorChain({ errMsg: 'mock' })
    assert.strictEqual(pageInstance.data.shadowRecordings.length, 1)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 12)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].hasAudio, false)
    assert.strictEqual(pageInstance._currentShadowSentence, null, 'snapshot cleared after error')
  })

  console.log('\n[17] Error recovery: recorder.start() throws → error entry recorded')
  await t('recorder.start() throws synchronously → _handleShadowRecordError called with sentence (no re-throw)', () => {
    resetPage()
    const s = newSentence(13, 'm', 0, 5000)
    recorder._started = true
    let didThrow = false
    try {
      pageInstance._startShadowRecording(s, 5000)
    } catch (e) {
      didThrow = true
    }
    assert.strictEqual(didThrow, false, 'try/catch in _startShadowRecording swallows the throw internally')
    assert.strictEqual(pageInstance.data.shadowRecordings.length, 1)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].sentenceOrder, 13)
    assert.strictEqual(pageInstance.data.shadowRecordings[0].hasAudio, false)
    recorder._started = false
  })

  console.log('\n[18] State integrity: snapshot survives across multiple _startShadowRecording calls')
  await t('after save, snapshot is null; after new start, snapshot is new sentence', () => {
    resetPage()
    const s1 = newSentence(1, 'a', 0, 5000)
    const s2 = newSentence(2, 'b', 5000, 10000)
    pageInstance._startShadowRecording(s1, 5000)
    assert.strictEqual(pageInstance._currentShadowSentence, s1)
    runOnStopChain({ tempFilePath: 'mock://r1.mp3', duration: 5000 })
    assert.strictEqual(pageInstance._currentShadowSentence, null, 'cleared after save')
    recorder._started = false
    pageInstance._startShadowRecording(s2, 5000)
    assert.strictEqual(pageInstance._currentShadowSentence, s2, 'set to new sentence')
  })

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
})()
