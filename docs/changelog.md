# Shadowing — 变更日志

## [2.7.0] — 2026-06-02

### 新增

#### 语境窗口（Context Window）
- 小程序：字幕区 3 层视觉层级 — 当前句高亮（品牌色+大字）、前后各 1 句半透明可读（0.5）、其余极淡（0.12+小字）
- 小程序：WXML 条件类 active/nearby/dimmed 替代原有 active/空二元
- 小程序：WXSS 0.3s transition 动画过渡切换句子时的视觉变化
- 纯前端实现，零后端改动，零 JS 逻辑改动

#### 逐词渲染 + 实时高亮 + 长按发音 + 词级音标
- 后端：Sentence 实体新增 `wordTimings` JSON 列（每词 {word, start, end} 毫秒偏移）
- 后端：新增 `/api/pronounce/:word` 公开接口 — 代理 Free Dictionary API，返回 IPA 音标+发音音频 URL，内存缓存
- 后端：新 PronounceModule（controller + service + module）注册到 AppModule
- 对齐脚本：`align_sentences.py` 提取 Whisper word_timestamps 写入 wordTimings 字段
- 小程序：练习页当前句逐词渲染（`<view wx:for="currentWords">`），每词可 `bindlongpress`
- 小程序：100ms 轮询追踪 `currentWordIndex`，当前词品牌色底色高亮（`.word-highlight`）
- 小程序：长按单词 → 调用 /pronounce/:word → 播放真人发音 + 显示 IPA 音标
- 小程序：发音缓存（`_pronounceCache`）避免重复请求
- 小程序：api.js 新增 `getPronounce`

## [2.6.0] — 2026-06-02

### 新增

#### 词级评分反馈（Phase 1 + Phase 2）
- 后端：asr.service.ts 用 SequenceMatcher LCS 算法替换 Set 匹配，返回 wordResults（每词标注 correct/missing/mispronounced/extra）
- 后端：asr.service.ts 新增 evaluateWithLLM()，评分 40-80 区间调用 DeepSeek V4 增强（判断同音词、缩写、口语变体）
- 后端：asr.controller.ts 评分管道升级 — Whisper ASR → 算法对齐 → 低置信度 LLM → 返回 wordResults + llmUsed 标志
- 后端：.env 新增 DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL 配置
- 小程序：practice.js 解析 wordResults 生成 wordDisplayData
- 小程序：practice.wxml 词级高亮（✅correct 绿色 / ❌missing 红色删除线 / ⚠️mispronounced 黄色下划线+提示 / extra 灰色斜体）
- 小程序：practice.wxss 新增 word-level 样式（4配色+flex wrap 布局）
- 降级兜底：无 wordResults 时仍显示旧的 missingWords 标签

### 改进

- 评分准确度：从词袋 Set 匹配升级为有序 LCS 对齐，消除语序错误（"I have been" vs "I been have" 现在正确定位）
- LLM 增强：DeepSeek V4 Flash 低置信度区间判断（40-80分），temperature=0 + json_object 保证稳定输出
- 成本：算法匹配 $0/次，LLM 仅触发约30%请求，估算 ¥0.9/万次

### 竞品调研总结

- 市场定位：微信小程序 + 纯跟读闭环 = 蓝海（响猫是唯一小程序竞品但做AI对话，不是跟读）
- 核心差异：3种模式+错题本+测评引导，竞品没有同等组合
- 词级反馈：ELSA/可栗/咕噜做到音素级，我们做词级是最低标准，后续可接讯飞语音评测API升到音素级
- 进阶路线：影子模式（同时跟读）> 智能暂停VAD > 回述模式 > 8阶段间隔复习 > 语境窗口 > 语调波形

## [2.5.0] — 2026-06-02

### 新增

#### 能力测评系统
- 后端：AssessmentSentence entity (a001~a005, 5级难度), UserProfile entity
- 后端：assessment 模块 — GET /sentences, POST /submit, GET /profile, GET /admin/stats
- 等级计算：avgScore→5级映射, selfReported vs assessed → accurate/underestimated/overestimated
- 推荐素材：按 assessedLevel 筛选 published 素材, 最多 3 条
- 小程序：onboarding 页 4 步流程（自报水平→选测评→测评跟读→结果展示）
- 小程序：app.js onboarding 检查（未完成自动跳转引导页）
- 小程序：api.js 新增 getAssessmentSentences/submitAssessment/getAssessmentProfile
- 管理数据：GET /assessment/admin/stats 聚合统计（总测评数、等级分布、匹配率、平均分）
- 测评音频：macOS say 生成 5 句 mp3（Samantha 语音，语速递增 beginner→fluent）
- 后端：main.ts 新增 /assessment/audio/ 静态文件 serve
- PostgreSQL：5 条 assessment_sentence 种子数据已插入

### 修复

- onboarding.js request 导入修复（module.exports 不是具名导出）
- 测评页音频路径：拼完整 http URL（InnerAudioContext 不支持相对路径）
- 测评句空表：补充 5 条种子数据

---

## [2.4.0] — 2026-06-02

### 新增

#### 首页改造
- Hero 卡片：进度条加粗 6rpx + min-width 12rpx（低进度也可见）；label+title+meta 信息层级
- 难度入口：三分格 level-card + 左侧色条（绿/黄/红）
- 新增「最近加入」区块：显示最新 2 条素材，点击进入练习

#### 素材库改进
- 进度条加粗 6rpx + min-width 16rpx
- 筛选栏可折叠：默认只显示口音行，点击「更多筛选」展开
- 卡片左侧 4rpx 色条按难度着色
- source 标签改为轻量灰色文字（无背景胶囊）

#### 练习页重设计
- 字幕区行间距 → CSS 变量（line-height-normal/loose）
- 反馈区重设计：得分+分标签、漏读轻量标签（带边框）、文本对比加分隔线
- 控制栏 → space-between 均衡布局，播放按钮 ctrl-btn-primary，循环键 active 态

#### 个人中心修复
- extra-stats 从水平双列改为垂直列表（label 左 + value 右），文字不再截断
- 统计区块 px→rpx 统一

### 修复

- **自动录音模式评分跳转过快**：评分显示后等 3 秒再跳下一句，而非录音结束 1.5 秒就跳
- formatDuration：<60秒显示 `N秒` 而非 `0:01`
- 数据库 source 字段：所有 yt-slug 改为人可读名称（Speak English with Vanessa、TED-Ed 等）

---

## [2.3.0] — 2026-06-02

### 修复

#### 去 AI 味 — 视觉去装饰化
- 首页 Hero：渐变背景 → 纯背景 + 左侧 6rpx 品牌色竖线指示
- 首页：🔥 emoji → 品牌色粗体数字；📚 emoji → 删除
- 素材库：删除假封面区域（渐变占位 + image 标签），改为纯列表卡片
- 素材库：🔍 emoji → 纯文字"搜索"；♥ 收藏 → 缩小 + 半透明
- 练习页：全部 emoji 按钮 → 文字按钮（录音/停止/回放/跳过）
- 练习页：符号控制栏 → 文字按钮（播放/暂停/上一句/下一句/循环/单次）
- 练习页：模式选择 emoji → 首字圆形徽章（自/录/手）
- 练习页：完成页 🎉 → 品牌色粗标题
- 练习页：反馈区 px/rpx 混用 → 统一 rpx
- 练习页：控制栏 rgba 硬编码 → CSS 变量
- 个人中心：🔥 → 品牌色数字；🔥⏰ → 文字标签（紧急/提醒）

#### 数据修复
- 素材 level 字段：A2/B1/B2/upper-intermediate → beginner/intermediate/advanced

#### Bug 修复
- request.js 循环依赖：`const { login } = require('./auth')` 从顶部移入 401 handler 内部，修复 `login is not a function`

---

## [2.2.0] — 2026-06-01

### 新增

#### 练习数据统计（Profile 页）
- `GET /practice-records/my/weekly-stats` 接口 — 返回7天每日句数+均分、整体均分、最常练素材
- 个人页新增"平均得分"+"最常练习"数字统计卡片
- 个人页新增7天热力条形图（纯CSS，每日高度=count占比，绿色active条）
- api.js 新增 getWeeklyStats()

---

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