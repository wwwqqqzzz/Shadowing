const { login } = require('./utils/auth')

App({
  onLaunch() {
    login().catch(err => {
      console.error('登录失败', err)
      wx.showToast({
        title: '网络异常，部分功能不可用',
        icon: 'none',
        duration: 3000
      })
    }).then(() => {
      this.checkOnboarding()
    })
  },
  globalData: {
    pendingFilter: null
  },
  async checkOnboarding() {
    const done = wx.getStorageSync('onboardingDone')
    if (!done) {
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/onboarding/onboarding' })
      }, 500)
    }
  }
})
