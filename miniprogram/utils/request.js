const BASE_URL = 'http://localhost:3000/api'

const request = ({ url, method = 'GET', data = {} }) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success: (res) => {
        if (res.statusCode === 401) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('user')
          const { login } = require('./auth')
          login().then(() => {
            resolve(request({ url, method, data }))
          }).catch(() => {
            reject(new Error('登录失效，请重启小程序'))
          })
          return
        }
        resolve(res.data)
      },
      fail: (err) => reject(err)
    })
  })
}

module.exports = request