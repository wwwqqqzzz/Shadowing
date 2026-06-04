# Shadowing 影子跟读 — Project Knowledge Base

**Updated:** 2026-06-02
**Branch:** main

## OVERVIEW

Shadowing 跟读训练系统：微信小程序 + NestJS 后端 + React 管理后台。
核心闭环：「播放一句 → 自动暂停 → 用户跟读 → 下一句」。支持三种模式（自由/自动录音/手动）。

## STRUCTURE

```
Shadowing/
├── miniprogram/      # 原生微信小程序 (WXML+WXSS+JS)
│   ├── pages/       # 8 页面: home/materials/practice/profile/wrong-book/wrong-review/settings/onboarding
│   ├── components/  # 3 组件: player/recorder/subtitle (未注册)
│   ├── utils/       # api/auth/format/request/util
│   └── mock/        # Phase 0 mock 数据
├── backend/         # NestJS API (TypeScript + TypeORM + PostgreSQL)
│   └── src/         # 10 模块: auth/materials/sentences/practice-records/users/asr/config/app-config/favorites/assessment
├── admin/           # React 19 + Ant Design 6 + Vite 8 后台管理
│   └── src/         # 2 页面: MaterialList(含编辑Modal)/ImportMaterial
├── docs/            # 产品规范
├── scripts/         # import-material, align_sentences, fix_algorithms, translate_sentences
└── tmp/             # 临时媒体处理目录
```

## NAVIGATION

```
tabBar 3-tab: 训练(home) | 素材库(materials) | 我的(profile)

home ──hero CTA──→ practice (startOrder续练)
home ──quick filter──→ materials (level筛选 passed via globalData.pendingFilter)
home ──错题本──→ wrong-book → wrong-review
materials ──tap card──→ practice (materialId)
materials ──♥──→ favorites API (POST/DELETE)
profile ──streak calendar──→ (3级: year/month/day)
profile ──settings──→ settings (练习模式选择)
onboarding ──4步──→ practice (推荐素材) 或 materials (tabBar)
首次进入 ──app.js检查──→ onboarding (如果未完成)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| 跟读训练核心逻辑 | `miniprogram/pages/practice/practice.js` | ~500行，含自动暂停/录音/回放/3种模式/startOrder续练 |
| 首页 Hero CTA | `miniprogram/pages/home/home.js` | 3状态(继续/推荐/开始)，streak条，错题提醒，快速筛选 |
| 素材库筛选+收藏 | `miniprogram/pages/materials/materials.js` | accent/level/duration/favOnly筛选，搜索，♥收藏切换 |
| 后端路由 | `backend/src/*/*.controller.ts` | 8 controllers，全局 /api 前缀 |
| 数据库实体 | `backend/src/*/entities/*.entity.ts` | 7 entities: Material/Sentence/PracticeRecord/User/AppConfig/Favorite |
| 后端服务层 | `backend/src/*/*.service.ts` | 8 services |
| 收藏模块 | `backend/src/favorites/` | Entity(唯一索引[user,material]) + Service + Controller(POST/DELETE/GET) |
| 续练接口 | `backend/src/practice-records/practice-records.controller.ts` | GET my/last-progress |
| 测评+引导 | `miniprogram/pages/onboarding/` | 4步引导(自报→选测评→测评跟读→结果) |
| 测评后端 | `backend/src/assessment/` | entity+service+controller, 等级计算+推荐 |
| 用户画像 | `backend/src/users/entities/user-profile.entity.ts` | selfReportedLevel/assessedLevel/onboardingStatus |
| 后台管理 | `admin/src/pages/MaterialList.tsx` | 素材列表+编辑Modal(accent/level/status) |
| 小程序 API | `miniprogram/utils/api.js` | 11个API函数，含getLastProgress/addFavorite/removeFavorite/getMyFavorites |
| 鉴权流程 | `miniprogram/utils/auth.js` + `backend/src/auth/` | JWT + wx.login |
| 错题本 | `miniprogram/pages/wrong-book/` + `wrong-review/` | 优先级排序，连续2次≥80移出，oneMorePass提示 |
| 打卡日历 | `miniprogram/pages/profile/profile.js` | 3级(year/month/day)日历，动态transform-origin缩放 |

## FEATURES IMPLEMENTED

### 跟读训练核心
- 3种模式：自由(不录音)、自动录音(ASR评分)、手动(用户控制)
- 模式选择：首次进入弹窗选择，后可通过设置页修改
- 播放：wx.createInnerAudioContext() + setInterval(100ms)轮询（不用onTimeUpdate）
- 录音：wx.getRecorderManager() 全局单例
- 续练：practice.js 接受 startOrder 参数，从指定句子开始

### 翻译
- 1301/1301 句子 100% 翻译完成（en→zh-CN）
- MyMemory API（429后弃用）+ 手动翻译 + sub-agent翻译

### 错题+复习系统
- 错题判定：连续2次 score ≥ mastery_threshold(80) 才移出错题本
- oneMorePass：最近1次≥80但前1次<80
- 优先级公式：(100-score)*0.6 + days*0.2 + errorCount*0.2
- 后端 AppConfig entity 存储 mastery_threshold

### 打卡+连续天数+日历
- getStreakStats: currentStreak/longestStreak/totalDays/todayDone/calendarDates(90天)
- 3级日历：年视图(3×4月份网格) → 月视图(7列日期+导航箭头) → 日视图(练习记录)
- 缩放动画：cubic-bezier(0.4,0,0.2,1) + 动态transform-origin
- Streak固定🔥 + 未打卡显示"今天还没练"

### 导航重构+首页+素材库升级
- tabBar: 3-tab (训练/素材库/我的)，深色主题
- 首页: hero CTA 3状态(继续/已完成/开始)，streak条，错题提醒，难度level-card+最近加入区块
- 素材库: accent/level/duration/favOnly筛选（可折叠），搜索，♥收藏，卡片难度色条
- 练习页: startOrder参数支持续练，自动录音模式评分后3秒再跳句
- 收藏: 后端favorites模块(CRUD)，小程序端Promise.all合并isFavorited
- 后端: accent列，duration过滤器，last-progress接口，admin PATCH :id
- 管理后台: MaterialList编辑Modal(accent/level/status)

### wordTimings 自动对齐 (Alignment)
- 后端: AlignmentModule (AlignmentService + AlignmentController)
- 接口: POST /admin/materials/:id/align (body: {model, async}, 默认 base + async)
- 策略: NestJS spawn scripts/align_sentences.py (Whisper base) as child process, --from-db + --update-wordtimings 安全模式
- 触发: (1) importFromVtt() 保存后自动 fire-and-forget 调用; (2) 手动调用 /admin/materials/:id/align
- 进度: 1198/1301 句 (92%) 已对齐; 4 个 BBC 素材停留在 36-45%
- **8% gap 根因分析** (2026-06-04): 4 个低覆盖素材的失败句子有共同模式
  - 句子 9-15 段: `Sam Oceans hold sixteen times more carbon...` 形式 (speaker tag 拼接到句首)
  - 失败句子包含专业词汇 (geoengineering, chock-a-block, geo-chemist names) Whisper 经常改写
  - 失败句子长度 70-150 字符, 单句太长 max_span=50 滑窗难匹配
  - **不可代码修复**: 失败由 (1) VTT 解析时漏剥 speaker tag (2) Whisper 转写偏差 (3) 长句匹配窗口不足 三因素叠加
  - **改进方向**: 若要 100% 覆盖需 (a) 手动修正 DB 中受污染句子 (b) 用 `small`/`medium` 模型重跑 (c) 提高 `max_span` 到 80
  - **当前策略**: 92% 覆盖率已实用; 失败的句子用 sentence-level 跳词 (无 word highlight) 不影响跟读功能

### 能力测评系统 (Assessment)
- 后端: AssessmentSentence entity (a001~a005, 5级), UserProfile entity, assessment模块
- 接口: GET /assessment/sentences (公开), POST /assessment/submit (JWT), GET /assessment/profile (JWT), GET /assessment/admin/stats (公开)
- 等级计算: avgScore→5级映射, selfReported vs assessed → accurate/underestimated/overestimated
- 推荐素材: 按assessedLevel筛选published素材, 最多3条
- 小程序: onboarding页4步(自报→选测评→测评跟读→结果), app.js onboarding检查
- 测评跟读: 复用音频播放+录音逻辑, 强制auto模式, 5句后自动提交

### v2.4.0 UI 全面改造
- 首页: 进度条6rpx+min-width，Hero信息层级(label+title+meta)，level-card色条，最近加入区块
- 素材库: 进度条6rpx+min-width，筛选栏折叠，source轻量化，卡片色条
- 练习页: 字幕行高CSS变量化，反馈区重设计(得分+标签+分隔线)，控制栏均衡布局
- 个人中心: extra-stats垂直列表，formatDuration秒级显示
- 数据: source字段人可读名称

## CONVENTIONS

### 非标准约定

- **后端 `noImplicitAny: false`** — 允许隐式 any 类型
- **tabBar 3 tab** — 训练(首页)/素材库/我的
- **自定义组件存在但未注册** — player/recorder/subtitle 未被任何页面引用
- **E2E 测试** — 仅有 app.e2e-spec.ts，无单元测试
- **TypeORM `synchronize: true`** — 生产环境需条件配置
- **JWT secret 直接从 `process.env` 读取** — 与数据库配置的 ConfigService 方式不一致
- **ES6 shorthand { foo } 只在变量名一致时用** — 否则必须 { foo: bar }
- **GET /materials 是公开接口不含 isFavorited** — 小程序端通过 getMyFavorites() 合并收藏状态

### 技术选型

- 小程序播放: `wx.createInnerAudioContext()`
- 录音: `wx.getRecorderManager()`（全局单例）
- 后端 ORM: TypeORM + PostgreSQL
- 鉴权: passport-jwt
- 后台: React 19 + Ant Design 6 + Vite 8 + TypeScript 6.0
- ASR: OpenAI Whisper `base` model (CPU)
- 素材下载: yt-dlp (MP3 + 字幕)
- 深色主题: #0f0f0f背景, #1a1a1a卡片, #a8e6cf强调色

## ANTI-PATTERNS（项目内禁止）

| 模式 | 说明 | 位置 |
|------|------|------|
| `as any` 类型断言 | TypeORM 关系类型绕过 | `practice-records.service.ts` `as any` |
| 静默吞错误 | catch 只 console.warn 不通知用户 | 多处 |
| 硬编码 API URL | localhost:3000 | `request.js:1`, `admin/api/materials.ts:3` |
| ⚠️ 微信 onTimeUpdate 不可靠 | iOS远程音频可能不触发，必须setInterval轮询 | `practice.js` |
| ⚠️ Timer padding 是绝对值陷阱 | 不超过200ms，否则300%误差 | `practice.js _startSentenceTimer` |
| ⚠️ YouTube 自动字幕不能用于对齐 | 逐词滚动式，必须走Whisper-only管道 | `scripts/align_sentences.py` |
| ⚠️ 新素材默认 draft | 前端只显示published，插入后必须SET published | DB material table |
| ⚠️ Mac代理 127.0.0.1:7897 | curl需手动设proxy，yt-dlp自动走系统代理 | 所有网络请求 |
| ⚠️ 句子边界必须 tighten | 不做tighten会导致播放开头空白 | `postprocess_alignment.py` |
| ⚠️ 收藏409 | addFavorite重复调用会Conflict，已修(本地合并isFavorited) | `materials.js` |

## COMMANDS

```bash
# Backend
cd backend && npm run start:dev    # 开发启动
cd backend && npm run test          # 单元测试（暂无spec文件）
cd backend && npm run test:e2e      # E2E测试
cd backend && npm run lint          # ESLint

# Admin
cd admin && npm run dev             # Vite开发服务器
cd admin && npm run build           # 生产构建

# Miniprogram
# WeChat IDE 打开 miniprogram/ 目录
```

## MANDATORY: Ops Logging

> **每次修改文件前必须写日志到 `.sisyphus/logs/YYYY-MM-DD.md`。**

格式:
```
HH:MM — Operation: file path
  What: 做了什么（1-2行）
  Why:  为什么做
```

前置写入：在 edit/write 之前先 append。不可跳过。

## ROUTE MAP

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| POST | `/auth/login` | AuthService.login | No |
| GET | `/materials` | MaterialsController.findAll | No (accent/level/status/duration filters) |
| GET | `/materials/:id` | MaterialsController.findById | No |
| GET | `/materials/:id/sentences` | MaterialsController.findSentences | No |
| POST | `/admin/materials/import` | AdminMaterialsController.importMaterial | No |
| PUT | `/admin/materials/:id/status` | AdminMaterialsController.updateStatus | No |
| PATCH | `/admin/materials/:id` | AdminMaterialsController.updateMaterial | No |
| PATCH | `/admin/materials/:id/offset` | AdminMaterialsController.updateOffset | No |
| PATCH | `/admin/materials/sentences/:id` | AdminMaterialsController.updateSentence | No |
| POST | `/admin/materials/:id/align` | AlignmentController.align | No |
| DELETE | `/admin/materials/:id` | AdminMaterialsController.deleteMaterial | No |
| POST | `/practice-records` | PracticeRecordsController.create | JWT |
| GET | `/practice-records/my/last-progress` | PracticeRecordsController.getLastProgress | JWT |
| GET | `/practice-records/my/streak` | PracticeRecordsController.getStreak | JWT |
| GET | `/practice-records/my/wrong/count` | PracticeRecordsController.getWrongCount | JWT |
| GET | `/practice-records/my/wrong` | PracticeRecordsController.getWrongSentences | JWT |
| GET | `/practice-records/my/stats` | PracticeRecordsController.getMyStats | JWT |
| GET | `/practice-records/my` | PracticeRecordsController.getMyRecords | JWT |
| POST | `/favorites/:materialId` | FavoritesController.addFavorite | JWT |
| DELETE | `/favorites/:materialId` | FavoritesController.removeFavorite | JWT |
| GET | `/favorites/my` | FavoritesController.getMyFavorites | JWT |
| GET | `/users/me` | UsersController.getProfile | JWT |
| GET | `/assessment/sentences` | AssessmentController.getSentences | No |
| POST | `/assessment/submit` | AssessmentController.submit | JWT |
| GET | `/assessment/profile` | AssessmentController.getProfile | JWT |
| GET | `/assessment/admin/stats` | AssessmentController.getStats | No |

## DB SCHEMA

```
Material: id(uuid), title, language, accent(american), level, coverUrl?, audioUrl, durationMs, status(draft), source?, audioOffsetMs, createdAt
Sentence: id(uuid), order, startTime, endTime, text, translation?, audioUrl?, → Material, → PracticeRecord[]
PracticeRecord: id(uuid), audioUrl?, score?, errorWords?, durationMs, createdAt → User, → Sentence
User: id(uuid), openid(unique), nickname?, avatarUrl?, preferredLanguage, createdAt
AppConfig: id(uuid), key(unique), value
Favorite: id(uuid), createdAt → User, → Material  [UNIQUE(user, material)]
AssessmentSentence: id(pk a001~a005), level, text, audioUrl, order, createdAt
UserProfile: id(uuid), → User, selfReportedLevel?, assessedLevel?, assessmentScore?, hasCompletedAssessment, assessmentCompletedAt?, onboardingStatus, createdAt, updatedAt
```