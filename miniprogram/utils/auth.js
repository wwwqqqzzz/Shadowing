const request = require('./request')

const login = () => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    if (token) return resolve(token)

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
          reject(err)
        }
      },
      fail: reject
    })
  })
}

module.exports = { login }
