const { getWrongSentences } = require('../../utils/api')

Page({
  data: {
    items: [],
    total: 0,
    loading: true,
    error: false
  },

  async onLoad() {
    try {
      const res = await getWrongSentences()
      this.setData({ items: res.items || [], total: res.total || 0, loading: false, error: false })
    } catch (err) {
      console.error('加载错题失败', err)
      this.setData({ loading: false, error: true })
    }
  },

  onRetry() {
    this.setData({ loading: true, error: false })
    this.onLoad()
  },

  onStartReview() {
    const app = getApp()
    app.globalData.wrongItems = this.data.items
    wx.navigateTo({ url: '/pages/wrong-review/wrong-review' })
  },

  onTapItem(e) {
    const index = e.currentTarget.dataset.index
    const app = getApp()
    app.globalData.wrongItems = this.data.items
    wx.navigateTo({ url: `/pages/wrong-review/wrong-review?startIndex=${index}` })
  }
})