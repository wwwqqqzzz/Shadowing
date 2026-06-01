# Shadowing — 变更日志

## [2.0.0] — 2026-06-01

### 新增

#### 导航重构
- tabBar 从 2-tab（素材/我的）改为 3-tab（训练/素材库/我的）
- 首页从空壳升级为完整 Hero CTA 页面
- 首页 Hero 3 状态：继续上次（带进度条）/ 今日推荐 / 去选择
- 首页打卡条：🔥连续天数 + 今天已打卡/还没练
- 首页错题提醒卡片：N 句待复习 → 跳转错题本
- 首页快速筛选：初级/中级/高级 → 素材库带 filter

#### 素材库升级
- 4 维筛选：口音(accent)/难度(level)/时长(duration)/仅收藏
- 搜索：标题和来源关键词
- 收藏 ♥ 切换：卡片右上角实心/空心爱心
- accent 标签显示（非 american 时显示英式/澳式/商务）

#### 收藏系统
- 后端 favorites 模块：Entity(唯一索引) + Service + Controller
- POST /favorites/:materialId — 收藏（409 冲突处理）
- DELETE /favorites/:materialId — 取消收藏
- GET /favorites/my — 我的收藏列表
- 小程序端 Promise.all 合并 isFavorited

#### 继续上次
- GET /practice-records/my/last-progress — 返回最近位置
- practice.js 接受 startOrder 参数，从指定句子开始
- 首页 Hero「继续」按钮跳转 practice?materialId=X&startOrder=Y

#### 后端筛选
- GET /materials 支持 accent 和 duration 查询参数
- duration: short(<5min) / medium(5-15min) / long(>15min)
- Material 实体新增 accent 列（default: 'american'）

#### 管理后台
- MaterialList 编辑 Modal：口音/难度/状态 Select 表单
- PATCH /admin/materials/:id — 部分更新素材属性
- accent 列显示

### 修复
- 收藏 409 Conflict：isFavorited 客户端合并，避免重复 addFavorite
- isLoggedIn() 守卫：未登录时不拉收藏列表

---

## [1.1.0] — 2026-05-31

### 新增
- 打卡+连续天数+3 级日历（年/月/日）
- 日历缩放动画（cubic-bezier + 动态 transform-origin）
- Streak 固定🔥，未打卡显示"今天还没练"
- 年视图前后年切换箭头

### 修复
- showCalendar ReferenceError：ES6 shorthand → 显式赋值
- 月视图标题重复：cal-title 在月级别留空
- 年视图切换：新增 onPrevYear/onNextYear

---

## [1.0.0] — 2026-05-29

### 新增
- 跟读训练核心：3 种模式（自由/自动录音/手动）
- ASR 评分：Whisper base model
- 错题本：优先级排序，连续 2 次≥80 移出
- 微信登录 + JWT 鉴权
- 素材导入（VTT 解析 + Whisper 对齐）
- React 管理后台（MaterialList + ImportMaterial）
- 1301 句子 100% 翻译（en→zh-CN）