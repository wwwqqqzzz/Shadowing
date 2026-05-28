Component({
  properties: {
    recording: Boolean
  },
  methods: {
    onStartRecord() {
      this.triggerEvent('startRecord')
    },
    onStopRecord() {
      this.triggerEvent('stopRecord')
    },
    onPlayback() {
      this.triggerEvent('playback')
    }
  }
})
