const { formatModeName } = require('../../utils/format')

const WAIT_OPTIONS = [
  { label: '1 秒', value: 1000 },
  { label: '2.5 秒', value: 2500 },
  { label: '4 秒', value: 4000 },
  { label: '6 秒', value: 6000 },
]

Page({
  data: {
    currentMode: '',
    modes: [
      { key: 'free', icon: '🎧', desc: '播完自动进下一句，不录音，适合通勤听' },
      { key: 'auto', icon: '🎙', desc: '播完自动录音评分，适合认真练习' },
      { key: 'manual', icon: '✋', desc: '自己控制录音和继续，适合反复练某句' },
    ],
    waitOptions: WAIT_OPTIONS,
    waitIndex: 1,
    waitLabel: '2.5 秒',
  },

  onLoad() {
    const storedWait = wx.getStorageSync('waitMs') || 2500
    const waitIndex = WAIT_OPTIONS.findIndex(o => o.value === storedWait)
    this.setData({
      currentMode: wx.getStorageSync('practiceMode') || 'free',
      waitIndex: waitIndex >= 0 ? waitIndex : 1,
      waitLabel: WAIT_OPTIONS[waitIndex >= 0 ? waitIndex : 1].label,
    })
  },

  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    wx.setStorageSync('practiceMode', mode)
    this.setData({ currentMode: mode })
    wx.showToast({ title: '已保存', icon: 'success', duration: 1000 })
  },

  onChangeWait(e) {
    const idx = parseInt(e.detail.value)
    const val = WAIT_OPTIONS[idx].value
    wx.setStorageSync('waitMs', val)
    this.setData({ waitIndex: idx, waitLabel: WAIT_OPTIONS[idx].label })
    wx.showToast({ title: '已保存', icon: 'success', duration: 800 })
  }
})