const { getMaterials, addFavorite, removeFavorite, getMyFavorites } = require('../../utils/api')
const { formatDuration } = require('../../utils/format')
const { isLoggedIn } = require('../../utils/auth')

Page({
  data: {
    materials: [],
    filtered: [],
    loading: true,
    filters: {
      accent: '',
      level: '',
      duration: '',
      favOnly: false,
      completed: false,
    },
    searchKeyword: '',
    showSearch: false,
  },

  async onLoad() {
    const app = getApp()
    if (app.globalData.pendingFilter) {
      this.setData({ filters: { ...this.data.filters, ...app.globalData.pendingFilter } })
      app.globalData.pendingFilter = null
    }
    await this.loadMaterials()
  },

  async onShow() {
    await this.loadMaterials()
  },

  async loadMaterials() {
    try {
      const [raw, favList] = await Promise.all([
        getMaterials({ status: 'published' }),
        isLoggedIn() ? getMyFavorites().catch(() => []) : Promise.resolve([]),
      ])
      const favIds = new Set(favList.map(f => f.id))
      const materials = raw.map(item => ({
        ...item,
        _durationText: formatDuration(item.durationMs),
        accent: item.accent || 'american',
        isFavorited: favIds.has(item.id),
        _progressText: item.progress
          ? item.progress.percent >= 95
            ? '已完成 ✓'
            : `${item.progress.percent}%`
          : null,
        _progressPercent: item.progress ? item.progress.percent : 0,
      }))
      this.setData({ materials, loading: false })
      this.applyFilters()
    } catch (err) {
      console.error('拉取素材列表失败', err)
      this.setData({ loading: false })
    }
  },

  applyFilters() {
    let list = [...this.data.materials]
    const { accent, level, duration, favOnly, completed } = this.data.filters
    const keyword = this.data.searchKeyword.trim()

    if (accent) list = list.filter(m => m.accent === accent)
    if (level) list = list.filter(m => m.level === level)
    if (duration === 'short') list = list.filter(m => m.durationMs < 300000)
    if (duration === 'medium') list = list.filter(m => m.durationMs >= 300000 && m.durationMs < 900000)
    if (duration === 'long') list = list.filter(m => m.durationMs >= 900000)
    if (favOnly) list = list.filter(m => m.isFavorited)
    if (completed) list = list.filter(m => m._progressPercent >= 95)
    if (keyword) list = list.filter(m =>
      m.title.toLowerCase().includes(keyword.toLowerCase()) ||
      (m.source || '').toLowerCase().includes(keyword.toLowerCase())
    )

    this.setData({ filtered: list })
  },

  onFilterChange(e) {
    const { type, value } = e.currentTarget.dataset
    const filters = { ...this.data.filters }
    if (type === 'completed' || type === 'favOnly') {
      filters[type] = !filters[type]
    } else if (filters[type] === value) {
      filters[type] = ''
    } else {
      filters[type] = value
    }
    this.setData({ filters })
    this.applyFilters()
  },

  onToggleSearch() {
    this.setData({ showSearch: !this.data.showSearch })
    if (!this.data.showSearch) {
      this.setData({ searchKeyword: '' })
      this.applyFilters()
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.applyFilters()
  },

  async onToggleFavorite(e) {
    const { id, favorited } = e.currentTarget.dataset
    try {
      if (favorited) {
        await removeFavorite(id)
      } else {
        await addFavorite(id)
      }
      const favList = await getMyFavorites()
      const favIds = new Set(favList.map(f => f.id))
      const materials = this.data.materials.map(m => ({
        ...m,
        isFavorited: favIds.has(m.id),
      }))
      this.setData({ materials })
      this.applyFilters()
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  onTapMaterial(e) {
    const { id, title } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/practice/practice?materialId=${id}&materialTitle=${encodeURIComponent(title || '')}`
    })
  },
})