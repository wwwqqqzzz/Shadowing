const request = require('./request')

const getMaterials = (params = {}) =>
  request({ url: '/materials', data: params })

const getMaterial = (id) =>
  request({ url: `/materials/${id}` })

const getSentences = (materialId) =>
  request({ url: `/materials/${materialId}/sentences` })

const createPracticeRecord = (data) =>
  request({ url: '/practice-records', method: 'POST', data })
    .catch(err => console.warn('写入训练记录失败（静默）', err))

const getMyRecords = (params = {}) =>
  request({ url: '/practice-records/my', data: params })

const getMyStats = () =>
  request({ url: '/practice-records/my/stats' })

module.exports = { getMaterials, getMaterial, getSentences, createPracticeRecord, getMyRecords, getMyStats }
