const { formatModeName } = require('../../utils/format')

Page({
  data: {
    currentMode: '',
    modes: [
      { key: 'free', icon: '🎧', desc: '播完自动进下一句，不录音，适合通勤听' },
      { key: 'auto', icon: '🎙', desc: '播完自动录音评分，适合认真练习' },
      { key: 'manual', icon: '✋', desc: '自己控制录音和继续，适合反复练某句' },
    ]
  },

  onLoad() {
    this.setData({
      currentMode: wx.getStorageSync('practiceMode') || 'free'
    })
  },

  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    wx.setStorageSync('practiceMode', mode)
    this.setData({ currentMode: mode })
    wx.showToast({ title: '已保存', icon: 'success', duration: 1000 })
  }
})