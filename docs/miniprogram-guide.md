# Shadowing — 小程序开发指南

> 最后更新：2026-06-01

## 页面导航

```
tabBar
├── 训练 (home)     ← 首页 Hero CTA
├── 素材库 (materials) ← 筛选+搜索+收藏
└── 我的 (profile)    ← 连续天数+日历+错题入口

非 tabBar 页面
├── practice     ← 跟读训练核心（wx.navigateTo）
├── wrong-book   ← 错题列表（wx.navigateTo）
├── wrong-review ← 错题复习（wx.navigateTo）
└── settings     ← 练习模式选择（wx.navigateTo）
```

## 页面职责

### home（训练首页）
- 3种 Hero 状态：继续上次 / 今日推荐 / 去选择
- 判断逻辑：有练习记录且进度<95% → 继续；有记录但≥95% → 推荐；无记录 → 去选择
- 卡通打卡条：🔥连续天数 + 今天已打卡/还没练
- 错题提醒卡片：wrongCount > 0 时显示
- 快速筛选按钮：初级/中级/高级 → switchTab 到素材库带 pendingFilter

### materials（素材库）
- 4维筛选：accent / level / duration / favOnly
- 搜索：标题和来源关键词
- 收藏切换：♥ 图标，调用 addFavorite/removeFavorite
- isFavorited 合并：loadMaterials 中 Promise.all(getMaterials, getMyFavorites) 合并

### practice（跟读训练）
- 3种模式：自由 / 自动录音(ASR) / 手动
- 模式选择：首次弹窗，后通过 settings 修改，wx.setStorageSync('practiceMode')
- startOrder 参数：从指定句子开始续练
- 音频：wx.createInnerAudioContext() + setInterval(100ms) 轮询（不用 onTimeUpdate）
- 录音：wx.getRecorderManager() 全局单例
- ASR 评分：wx.uploadFile → /api/asr/evaluate

### profile（我的）
- 统计：句数 / 总时长 / 🔥连续天数
- 打卡日历：3级视图（年/月/日），缩放动画
- 错题本入口
- 设置入口

### wrong-book / wrong-review
- 错题按优先级排序：(100-score)*0.6 + days*0.2 + errorCount*0.2
- oneMorePass：最近1次≥80但前1次<80
- 移出条件：连续2次 score ≥ mastery_threshold(80)
- 复习流程：播放→录音→ASR评分→结果页

## API 调用模式

```javascript
// api.js — 所有接口的封装
const { getMaterials, addFavorite, removeFavorite, getMyFavorites,
        getLastProgress, getMyStats, getWrongCount, getStreakStats } = require('../../utils/api')

// 并行加载（避免串行瀑布）
const [progress, stats, wrongData] = await Promise.all([
  getLastProgress().catch(() => null),
  getMyStats().catch(() => null),
  getWrongCount().catch(() => ({ count: 0 })),
])

// 收藏合并模式 — GET /materials 是公开接口不含 isFavorited
const [raw, favList] = await Promise.all([
  getMaterials({ status: 'published' }),
  isLoggedIn() ? getMyFavorites().catch(() => []) : Promise.resolve([]),
])
const favIds = new Set(favList.map(f => f.id))
const materials = raw.map(m => ({ ...m, isFavorited: favIds.has(m.id) }))

// 收藏切换 — 本地刷新而非全量重载
async onToggleFavorite(e) {
  const { id, favorited } = e.currentTarget.dataset
  if (favorited) { await removeFavorite(id) }
  else { await addFavorite(id) }
  // 只刷新收藏状态，不重载整个列表
  const favList = await getMyFavorites()
  const favIds = new Set(favList.map(f => f.id))
  const materials = this.data.materials.map(m => ({ ...m, isFavorited: favIds.has(m.id) }))
  this.setData({ materials })
  this.applyFilters()
}
```

## 跨页面状态传递

```javascript
// home → materials 筛选传递
// app.js globalData.pendingFilter
onTapLevelFilter(e) {
  const app = getApp()
  app.globalData.pendingFilter = { level: e.currentTarget.dataset.level }
  wx.switchTab({ url: '/pages/materials/materials' })
}

// materials onLoad 读取
async onLoad() {
  const app = getApp()
  if (app.globalData.pendingFilter) {
    this.setData({ filters: { ...this.data.filters, ...app.globalData.pendingFilter } })
    app.globalData.pendingFilter = null
  }
}
```

## 深色主题常量

```
背景：    #0f0f0f
卡片：    #1a1a1a
强调：    #a8e6cf
文字主：  #ffffff
文字次：  #888888
文字弱：  #555555
标签背景：#2a2a2a
初级色：  #a8e6cf (绿)
中级色：  #ffd97d (黄)
高级色：  #ff9999 (红)
收藏色：  #e8a87c (橙)
导航背景：#0f0f0f
导航文字：white
```

## 常见坑

| 坑 | 说明 | 解决 |
|---|------|------|
| onTimeUpdate 不可靠 | iOS 远程音频不触发 | setInterval(100ms) 轮询 |
| Timer padding 陷阱 | 绝对值 padding 导致 300% 误差 | ≤200ms |
| 收藏 409 | addFavorite 重复调用 Conflict | 先合并 isFavorited，只对 false 调 add |
| 新素材 draft | 前端只显示 published | 导入后 SET published |
| ES6 shorthand | `{ showCalendar }` 引用不存在的变量 | 显式写 `{ showCalendar: show }` |