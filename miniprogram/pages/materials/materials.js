const { getMaterials } = require('../../utils/api')
const { formatDuration } = require('../../utils/format')

Page({
  data: {
    materials: [],
    loading: true
  },

  async onLoad() {
    try {
      const raw = await getMaterials({ status: 'published' })
      const materials = raw.map(item => ({
        ...item,
        _durationText: formatDuration(item.durationMs)
      }))
      this.setData({ materials, loading: false })
    } catch (err) {
      console.error('拉取素材列表失败', err)
      this.setData({ loading: false })
    }
  },

  onTapMaterial(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/practice/practice?materialId=${id}` })
  }
})
