# Shadowing — 变更日志

## [2.1.0] — 2026-06-01

### 新增

#### 练习进度保存
- 后端 Progress 模块：Entity(user+material 唯一索引) + Service + Controller
- POST /progress — upsert 保存当前句子位置
- GET /progress/:materialId — 获取某素材的练习进度
- GET /practice-records/my/last-progress — 优先查 progress 表，fallback practice_record
- GET /materials 带 JWT 时附带 progress 字段（OptionalJwtAuthGuard）
- 小程序 practice.js onHide/onUnload 自动保存进度
- 素材卡片进度条：<95% 显示绿色百分比，≥95% 显示 "已完成 ✓"

#### 练习完成页
- 练完最后一句 → 全屏完成页覆盖（🎉 练习完成）
- 统计：总句数 + 用时 + 平均分（自动录音模式）
- "重新练" 按钮：重置进度到第1句重新开始
- "返回" 按钮：navigateBack()

#### 已完成筛选 + Hero replay
- 素材库新增 "已完成" toggle 筛选（progress≥95%）
- 首页 Hero 3 状态：继续上次(<95%) / 重新练(≥95%, startOrder=1) / 去选择
- 跳转 practice 时传递 materialTitle 参数

### 修复
- getBatchProgress 改用 createQueryBuilder + getRawMany 避免 TypeORM relation 序列化问题
- onTogglePlay 在 finished 状态不再触发播放

---

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