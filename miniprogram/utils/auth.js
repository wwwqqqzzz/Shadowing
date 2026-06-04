const { request } = require('./request')

const MAX_RETRY = 1

const login = (retry = 0) => {
  const token = wx.getStorageSync('token')
  if (token) return Promise.resolve(token)

  return new Promise((resolve, reject) => {
    wx.login({
      success: async ({ code }) => {
        try {
          const res = await request({
            url: '/auth/login',
            method: 'POST',
            data: { code }
          })
          wx.setStorageSync('token', res.token)
          wx.setStorageSync('user', res.user)
          resolve(res.token)
        } catch (err) {
          if (retry < MAX_RETRY) {
            setTimeout(() => login(retry + 1).then(resolve).catch(reject), 1000)
          } else {
            reject(err)
          }
        }
      },
      fail: reject
    })
  })
}

const isLoggedIn = () => {
  return !!wx.getStorageSync('token')
}

module.exports = { login, isLoggedIn }