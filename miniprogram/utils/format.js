const formatDuration = (ms) => {
  if (!ms && ms !== 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatRelativeTime = (isoString) => {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  return `${days} 天前`
}

const formatModeName = (mode) => {
  const map = { free: '自由模式', auto: '自动录音', manual: '手动模式' }
  return map[mode] || '自由模式'
}

const buildCalendar = (practiceDates) => {
  const doneSet = new Set(practiceDates)
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const months = []

  for (let m = 1; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const monthLabel = `${year}年${month + 1}月`

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
    months.push({ label: monthLabel, cells })
  }
  return months
}

module.exports = { formatDuration, formatRelativeTime, formatModeName, buildCalendar }
