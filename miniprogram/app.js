const { login } = require('./utils/auth')

App({
  onLaunch() {
    login().catch(err => console.error('登录失败', err))
  },
  globalData: {}
})
