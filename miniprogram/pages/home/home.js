const { getLastProgress, getMyStats, getWrongCount, getMaterials } = require('../../utils/api')

Page({
  data: {
    heroState: 'start',
    lastProgress: null,
    currentStreak: 0,
    todayDone: false,
    wrongCount: 0,
    recentMaterials: [],
    loading: true,
  },

  async onShow() {
    try {
      const [progress, stats, wrongData, materials] = await Promise.all([
        getLastProgress().catch(() => null),
        getMyStats().catch(() => null),
        getWrongCount().catch(() => ({ count: 0 })),
        getMaterials({ status: 'published' }).catch(() => []),
      ])

      let heroState = 'start'
      if (progress && progress.progressPercent >= 95) {
        heroState = 'replay'
      } else if (progress) {
        heroState = 'continue'
      }

      const recentMaterials = materials
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 2)

      this.setData({
        heroState,
        lastProgress: progress,
        currentStreak: stats ? stats.currentStreak : 0,
        todayDone: stats ? stats.todayDone : false,
        wrongCount: wrongData ? wrongData.count : 0,
        recentMaterials,
        loading: false,
      })
    } catch (err) {
      console.error('首页加载失败', err)
      this.setData({ loading: false })
    }
  },

  onTapHero() {
    const { heroState, lastProgress } = this.data
    if (!lastProgress) {
      wx.switchTab({ url: '/pages/materials/materials' })
      return
    }
    const id = lastProgress.material.id
    const title = encodeURIComponent(lastProgress.material.title || '')
    if (heroState === 'continue') {
      wx.navigateTo({
        url: `/pages/practice/practice?materialId=${id}&startOrder=${lastProgress.lastSentenceOrder}&materialTitle=${title}`,
      })
    } else if (heroState === 'replay') {
      wx.navigateTo({
        url: `/pages/practice/practice?materialId=${id}&startOrder=1&materialTitle=${title}`,
      })
    } else {
      wx.switchTab({ url: '/pages/materials/materials' })
    }
  },

  onTapWrongBook() {
    wx.navigateTo({ url: '/pages/wrong-book/wrong-book' })
  },

  onTapLevelFilter(e) {
    const { level } = e.currentTarget.dataset
    const app = getApp()
    app.globalData.pendingFilter = { level }
    wx.switchTab({ url: '/pages/materials/materials' })
  },

  onTapAllMaterials() {
    wx.switchTab({ url: '/pages/materials/materials' })
  },

  onTapRecentMaterial(e) {
    const { id, title } = e.currentTarget.dataset
    const encodedTitle = encodeURIComponent(title || '')
    wx.navigateTo({
      url: `/pages/practice/practice?materialId=${id}&materialTitle=${encodedTitle}`,
    })
  },
})