const request = require('./request')

const getMaterials = (params = {}) =>
  request({ url: '/materials', data: params })

const getMaterial = (id) =>
  request({ url: `/materials/${id}` })

const getSentences = (materialId) =>
  request({ url: `/materials/${materialId}/sentences` })

const createPracticeRecord = (data) =>
  request({ url: '/practice-records', method: 'POST', data })
    .catch(err => {
      console.error('写入训练记录失败', err)
    })

const getMyRecords = (params = {}) =>
  request({ url: '/practice-records/my', data: params })

const getMyStats = () =>
  request({ url: '/practice-records/my/stats' })

const getWeeklyStats = () =>
  request({ url: '/practice-records/my/weekly-stats' })

const getWrongSentences = () =>
  request({ url: '/practice-records/my/wrong' })

const getWrongCount = () =>
  request({ url: '/practice-records/my/wrong/count' })

const getStreakStats = () =>
  request({ url: '/practice-records/my/streak' })

const getLastProgress = () =>
  request({ url: '/practice-records/my/last-progress' })

const saveProgress = (materialId, sentenceOrder, totalSentences) =>
  request({
    url: '/progress',
    method: 'POST',
    data: { materialId, sentenceOrder, totalSentences },
  }).catch(err => {
    console.warn('保存进度失败', err)
  })

const getProgress = (materialId) =>
  request({ url: `/progress/${materialId}` }).catch(() => null)

const addFavorite = (materialId) =>
  request({ url: `/favorites/${materialId}`, method: 'POST' })

const removeFavorite = (materialId) =>
  request({ url: `/favorites/${materialId}`, method: 'DELETE' })

const getMyFavorites = () =>
  request({ url: '/favorites/my' })

const getAssessmentSentences = () =>
  request({ url: '/assessment/sentences' })

const submitAssessment = (data) =>
  request({ url: '/assessment/submit', method: 'POST', data })

const getAssessmentProfile = () =>
  request({ url: '/assessment/profile' })

module.exports = {
  getMaterials, getMaterial, getSentences,
  createPracticeRecord,
  getMyRecords, getMyStats, getWeeklyStats,
  getWrongSentences, getWrongCount, getStreakStats,
  getLastProgress, saveProgress, getProgress,
  addFavorite, removeFavorite, getMyFavorites,
  getAssessmentSentences, submitAssessment, getAssessmentProfile,
}