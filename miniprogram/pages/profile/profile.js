const { getMyStats } = require('../../utils/api')
const { formatDuration, formatRelativeTime } = require('../../utils/format')

Page({
  data: {
    totalSentences: 0,
    totalDurationText: '0:00',
    recentRecords: [],
    loading: true
  },

  async onShow() {
    try {
      const stats = await getMyStats()
      this.setData({
        totalSentences: stats.totalSentences,
        totalDurationText: formatDuration(stats.totalDurationMs),
        recentRecords: stats.recentRecords.map(r => ({
          ...r,
          createdAtText: formatRelativeTime(r.createdAt),
          durationText: formatDuration(r.durationMs)
        })),
        loading: false
      })
    } catch (err) {
      console.error('拉取统计失败', err)
      this.setData({ loading: false })
    }
  },

  onTapMaterial() {
    wx.switchTab({ url: '/pages/materials/materials' })
  }
})
