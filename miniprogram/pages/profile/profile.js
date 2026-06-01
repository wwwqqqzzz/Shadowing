const { getMyStats, getWeeklyStats, getWrongCount, getStreakStats } = require('../../utils/api')
const { formatDuration, formatRelativeTime } = require('../../utils/format')

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildMonthGrid(year, month, doneSet) {
  const today = new Date()
  const todayStr = fmtDate(today)
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push({ empty: true })
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({
      day,
      dateStr,
      done: doneSet.has(dateStr),
      isToday: dateStr === todayStr,
      isFuture: new Date(dateStr) > today
    })
  }
  return cells
}

function buildYearGrid(year, doneSet) {
  const today = new Date()
  const months = []
  for (let m = 0; m < 12; m++) {
    let count = 0
    const daysInMonth = new Date(year, m + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (doneSet.has(ds)) count++
    }
    months.push({
      month: m,
      label: MONTH_NAMES[m],
      count,
      isCurrent: year === today.getFullYear() && m === today.getMonth()
    })
  }
  return months
}

Page({
  data: {
    totalSentences: 0,
    totalDurationText: '0:00',
    overallAvgScore: 0,
    topMaterialText: '',
    weeklyData: [],
    barMax: 1,
    recentRecords: [],
    wrongCount: 0,
    wrongDaysSince: null,
    currentStreak: 0,
    longestStreak: 0,
    totalDays: 0,
    todayDone: false,
    streakEmoji: '',
    loading: true,
    showCalendar: false,
    calendarLevel: 'year',
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(),
    selectedDate: '',
    yearGrid: [],
    monthCells: [],
    weekdays: WEEKDAYS,
    monthLabel: '',
    dayRecords: [],
    daySummary: null,
    calOriginX: '50%',
    calOriginY: '50%',
    calAnimating: false
  },

  _doneSet: new Set(),

  async onShow() {
    try {
      const [stats, wrongData, streak, weekly] = await Promise.all([
        getMyStats(),
        getWrongCount().catch(() => ({ count: 0, lastReviewedAt: null })),
        getStreakStats().catch(() => ({ currentStreak: 0, longestStreak: 0, totalDays: 0, todayDone: false, calendarDates: [] })),
        getWeeklyStats().catch(() => ({ weeklyData: [], overallAvgScore: 0, topMaterial: null })),
      ])

      const daysSinceReview = wrongData.lastReviewedAt
        ? Math.floor((Date.now() - new Date(wrongData.lastReviewedAt).getTime()) / 86400000)
        : null

      this._doneSet = new Set(streak.calendarDates || [])

      const topMaterialText = weekly.topMaterial
        ? `${weekly.topMaterial.title} · ${weekly.topMaterial.count}次`
        : ''

      const barMax = Math.max(1, ...weekly.weeklyData.map(d => d.count))

      this.setData({
        totalSentences: stats.totalSentences,
        totalDurationText: formatDuration(stats.totalDurationMs),
        overallAvgScore: weekly.overallAvgScore,
        topMaterialText,
        weeklyData: weekly.weeklyData.map(d => ({
          ...d,
          barHeight: Math.round((d.count / barMax) * 100),
        })),
        barMax,
        recentRecords: stats.recentRecords.map(r => ({
          ...r,
          createdAtText: formatRelativeTime(r.createdAt),
          durationText: formatDuration(r.durationMs)
        })),
        wrongCount: wrongData.count,
        wrongDaysSince: daysSinceReview,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        totalDays: streak.totalDays,
        todayDone: streak.todayDone,
        streakEmoji: '🔥',
        calendarYear: new Date().getFullYear(),
        calendarMonth: new Date().getMonth(),
        loading: false
      })
    } catch (err) {
      console.error('拉取统计失败', err)
      this.setData({ loading: false })
    }
  },

  onToggleCalendar() {
    if (this.data.calAnimating) return
    const show = !this.data.showCalendar
    this.setData({ showCalendar: show, calendarLevel: 'year' })
    if (show) this._refreshYearGrid()
  },

  onYearMonthTap(e) {
    if (this.data.calAnimating) return
    const { month } = e.currentTarget.dataset
    const { x, y } = this._getOrigin(e)
    this.setData({
      calOriginX: x + 'px',
      calOriginY: y + 'px',
      calAnimating: true,
      calendarMonth: month,
      calendarLevel: 'month'
    })
    this._refreshMonthGrid()
    setTimeout(() => this.setData({ calAnimating: false }), 600)
  },

  onMonthDayTap(e) {
    if (this.data.calAnimating) return
    const { date } = e.currentTarget.dataset
    if (!date) return
    const { x, y } = this._getOrigin(e)
    this.setData({
      calOriginX: x + 'px',
      calOriginY: y + 'px',
      calAnimating: true,
      calendarLevel: 'day',
      selectedDate: date
    })
    this._refreshDayRecords(date)
    setTimeout(() => this.setData({ calAnimating: false }), 600)
  },

  onCalendarBack() {
    if (this.data.calAnimating) return
    const level = this.data.calendarLevel
    if (level === 'day') {
      this.setData({ calAnimating: true, calendarLevel: 'month' })
    } else if (level === 'month') {
      this.setData({ calAnimating: true, calendarLevel: 'year' })
      this._refreshYearGrid()
    }
    setTimeout(() => this.setData({ calAnimating: false }), 600)
  },

  onPrevMonth() {
    let { calendarYear, calendarMonth } = this.data
    calendarMonth--
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear-- }
    this.setData({ calendarYear, calendarMonth })
    this._refreshMonthGrid()
  },

  onNextMonth() {
    let { calendarYear, calendarMonth } = this.data
    calendarMonth++
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++ }
    this.setData({ calendarYear, calendarMonth })
    this._refreshMonthGrid()
  },

  onPrevYear() {
    this.setData({ calendarYear: this.data.calendarYear - 1 })
    this._refreshYearGrid()
  },

  onNextYear() {
    this.setData({ calendarYear: this.data.calendarYear + 1 })
    this._refreshYearGrid()
  },

  _getOrigin(e) {
    const touch = e.changedTouches && e.changedTouches[0]
    if (touch) return { x: touch.x, y: touch.y }
    return { x: 200, y: 200 }
  },

  _refreshYearGrid() {
    const yearGrid = buildYearGrid(this.data.calendarYear, this._doneSet)
    this.setData({ yearGrid })
  },

  _refreshMonthGrid() {
    const { calendarYear, calendarMonth } = this.data
    const monthCells = buildMonthGrid(calendarYear, calendarMonth, this._doneSet)
    const monthLabel = `${calendarYear}年${calendarMonth + 1}月`
    this.setData({ monthCells, monthLabel })
  },

  _refreshDayRecords(dateStr) {
    const records = this.data.recentRecords || []
    const dayRecords = records.filter(r => r.createdAt && r.createdAt.startsWith(dateStr))
    this.setData({
      dayRecords,
      daySummary: dayRecords.length > 0 ? { count: dayRecords.length, date: dateStr } : null
    })
  },

  onTapMaterial() {
    wx.switchTab({ url: '/pages/materials/materials' })
  },

  onTapWrongBook() {
    wx.navigateTo({ url: '/pages/wrong-book/wrong-book' })
  },

  onTapSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  }
})