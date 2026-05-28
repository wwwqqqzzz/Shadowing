Component({
  properties: {
    playing: Boolean,
    speed: Number,
    loop: Boolean
  },
  methods: {
    onTogglePlay() {
      if (this.data.playing) {
        this.triggerEvent('pause')
      } else {
        this.triggerEvent('play')
      }
    },
    onSpeedChange() {
      const speeds = [0.5, 0.75, 1, 1.5, 2]
      const currentIdx = speeds.indexOf(this.data.speed)
      const nextSpeed = speeds[(currentIdx + 1) % speeds.length]
      this.triggerEvent('speedChange', { speed: nextSpeed })
    },
    onSkipPrev() {
      this.triggerEvent('skipPrev')
    },
    onSkipNext() {
      this.triggerEvent('skipNext')
    },
    onLoop() {
      this.triggerEvent('loop')
    }
  }
})
