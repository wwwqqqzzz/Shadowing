export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const formatTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const LEVEL_LABELS: Record<string, string> = {
  beginner: '入门',
  intermediate: '中级',
  advanced: '高级',
}

export const LEVEL_COLORS: Record<string, string> = {
  beginner: 'green',
  intermediate: 'gold',
  advanced: 'red',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  published: 'processing',
}