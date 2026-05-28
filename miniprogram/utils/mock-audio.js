/**
 * Phase 0: Timer-based virtual audio engine.
 * Simulates playback timing so we can verify the auto-pause
 * and sentence flow without a real audio file.
 *
 * Replace with wx.createInnerAudioContext() in Phase 1.
 */
class MockAudio {
  constructor() {
    this._currentTime = 0
    this._speed = 1
    this._playing = false
    this._timer = null
    this._startPosition = 0
    this._startTime = 0
    this._intervalMs = 50
    this._onTimeUpdate = null
  }

  get currentTime() {
    return this._currentTime
  }

  get playing() {
    return this._playing
  }

  set onTimeUpdate(cb) {
    this._onTimeUpdate = cb
  }

  play() {
    if (this._playing) return
    this._playing = true
    this._startTime = Date.now()
    this._startPosition = this._currentTime
    this._timer = setInterval(() => {
      const elapsed = (Date.now() - this._startTime) * this._speed
      this._currentTime = this._startPosition + elapsed
      if (this._onTimeUpdate) {
        this._onTimeUpdate({ currentTime: this._currentTime })
      }
    }, this._intervalMs)
  }

  pause() {
    if (!this._playing) return
    this._playing = false
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  seek(timeMs) {
    this._currentTime = timeMs
    if (this._playing) {
      clearInterval(this._timer)
      this._startTime = Date.now()
      this._startPosition = timeMs
      this._timer = setInterval(() => {
        const elapsed = (Date.now() - this._startTime) * this._speed
        this._currentTime = this._startPosition + elapsed
        if (this._onTimeUpdate) {
          this._onTimeUpdate({ currentTime: this._currentTime })
        }
      }, this._intervalMs)
    }
  }

  setSpeed(rate) {
    this._speed = rate
    if (this._playing) {
      this.pause()
      this.play()
    }
  }

  destroy() {
    this.pause()
    this._onTimeUpdate = null
  }
}

module.exports = { MockAudio }
