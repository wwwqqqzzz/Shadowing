Component({
  properties: {
    sentences: Array,
    currentIndex: Number,
    progress: Number
  },
  methods: {
    onSentenceTap(e) {
      const index = e.currentTarget.dataset.index
      this.triggerEvent('tapSentence', { index })
    }
  }
})
