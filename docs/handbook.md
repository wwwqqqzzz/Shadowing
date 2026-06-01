# Shadowing 影子跟读 — 开发者手册

> 读完这一份，就能上手开发。

---

## 1. 这是什么

Shadowing 是微信小程序 + NestJS 后端的英语影子跟读训练系统。

**核心闭环**：播放一句原声 → 自动暂停 → 用户跟读 → ASR 评分 → 下一句。

**一句话目标**：最小化从打开小程序到开口说话的时间。

---

## 2. 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 小程序 | WXML + WXSS + JS | 原生，无跨端框架 |
| 后端 | NestJS + TypeORM + PostgreSQL | TypeScript，synchronize: true |
| 管理后台 | React 19 + Ant Design 6 + Vite 8 | TypeScript 6.0 |
| ASR | OpenAI Whisper base | CPU 推理 |
| 鉴权 | passport-jwt | wx.login → mock openid → JWT |
| 深色主题 | #0f0f0f 背景 / #1a1a1a 卡片 / #a8e6cf 强调色 | 全局统一 |

---

## 3. 本地启动

```bash
# 1. PostgreSQL — 创建数据库
createdb shadowing_dev   # user: wang, 无密码

# 2. 后端
cd backend
npm install
npm run start:dev        # http://localhost:3000/api
# TypeORM synchronize: true 会自动建表

# 3. 管理后台
cd admin
npm install
npm run dev              # http://localhost:5173

# 4. 小程序
# 微信开发者工具打开 miniprogram/ 目录
# 本地设置：不校验合法域名
```

---

## 4. 目录结构

```
Shadowing/
├── miniprogram/                # 微信小程序
│   ├── pages/
│   │   ├── home/               # 训练首页 (tabBar)
│   │   ├── materials/          # 素材库 (tabBar)
│   │   ├── profile/           # 我的 (tabBar)
│   │   ├── practice/          # 跟读训练 核心页面
│   │   ├── wrong-book/        # 错题列表
│   │   ├── wrong-review/      # 错题复习
│   │   └── settings/         # 模式选择
│   ├── utils/
│   │   ├── api.js             # 14 个 API 函数
│   │   ├── auth.js            # wx.login + JWT
│   │   ├── format.js          # duration/relativeTime/modeName
│   │   ├── request.js          # HTTP 封装 (localhost:3000/api)
│   │   └── util.js
│   ├── mock/                  # Phase 0 mock 数据
│   └── app.js/json/wxss       # tabBar 3-tab, globalData.pendingFilter
│
├── backend/src/               # NestJS 后端
│   ├── auth/                  # wx.login mock → JWT + OptionalJwtAuthGuard
│   ├── materials/             # 素材 CRUD + accent/duration 过滤 + admin 管理
│   │   ├── entities/material.entity.ts   # accent, level, durationMs, status
│   │   ├── materials.controller.ts      # GET /materials (OptionalJwtAuthGuard)
│   │   ├── materials.service.ts          # findAll 带过滤器 + progress 合并
│   │   └── admin-materials.controller.ts # POST import, PATCH, DELETE
│   ├── sentences/             # 句子实体 (无 controller)
│   ├── practice-records/      # 练习记录 + stats + streak + wrong + last-progress
│   ├── progress/              # 练习进度保存 (upsert, batch, latest)
│   │   ├── entities/progress.entity.ts  # user+material 唯一索引
│   │   ├── progress.service.ts           # saveProgress, getBatchProgress, getLatestProgress
│   │   └── progress.controller.ts       # POST, GET
│   ├── favorites/             # 收藏 CRUD (POST/DELETE/GET, 唯一索引)
│   ├── users/                 # 用户 profile
│   ├── asr/                   # Whisper 转写 + 评分
│   ├── config/                # 数据库配置 (ConfigService)
│   └── app-config/           # AppConfig 键值存储 (mastery_threshold=80)
│
├── admin/src/                 # React 管理后台
│   ├── pages/MaterialList.tsx  # 素材列表 + 编辑 Modal
│   ├── pages/ImportMaterial.tsx # 素材导入 (Steps + Upload)
│   ├── api/materials.ts       # API 封装 (含 updateMaterial PATCH)
│   └── utils/format.ts        # LEVEL/ACCENT/STATUS 标签常量
│
├── scripts/                   # 工具脚本
│   ├── import-material.js      # 素材导入
│   ├── align_sentences.py      # Whisper 对齐
│   └── translate_sentences.py  # 翻译
│
└── docs/                      # 项目文档
    ├── product-spec.md         # 产品规范 (原始)
    ├── architecture.md         # 架构详细
    ├── api-reference.md        # API 端点详细
    ├── miniprogram-guide.md    # 小程序开发详细
    ├── deployment.md           # 部署详细
    └── changelog.md           # 版本变更
```

---

## 5. 页面导航与功能

```
tabBar
├── 训练 (home)             ← Hero CTA 3状态 + streak条 + 错题提醒 + 快速筛选
├── 素材库 (materials)       ← 5维筛选 + 搜索 + ♥收藏 + ✓已完成筛选
└── 我的 (profile)           ← 统计 + 3级日历 + 错题本入口 + 设置入口

非 tabBar (wx.navigateTo)
├── practice                 ← 核心跟读 (3模式 + startOrder续练 + 完成页)
├── wrong-book               ← 错题列表 (优先级排序)
├── wrong-review             ← 错题复习 (播放→录音→评分→结果)
└── settings                 ← 模式选择 (自由/自动/手动)
```

### 首页 Hero 逻辑

```
onShow:
  getLastProgress() ──→ 有且进度<95% → "继续上次"
                        有且进度≥95% → "重新练" (从头开始)
                        无/空       → "去选择"

继续跳转: practice?materialId=X&startOrder=Y&materialTitle=...
重新练:   practice?materialId=X&startOrder=1&materialTitle=...
快速筛选: globalData.pendingFilter = { level } → switchTab 素材库
```

### 练习完成页

```
练完最后一句 → 显示完成页覆盖层:
  🎉 练习完成
  Rachel's English
  76 句 · 12:30
  平均 85 分          ← 仅自动录音模式显示
  [重新练]  [返回]

重新练: currentIndex=0, sessionScores=[], practiceStartTime=now, saveProgress(1)
返回: navigateBack()
```

### 进度保存策略

```
onHide / onUnload → saveProgress(materialId, currentSentenceOrder, totalSentences)
练完最后一句     → saveProgress(materialId, 1, totalSentences)  ← 重置为第1句

GET /practice-records/my/last-progress
  优先查 progress 表（更准确，中途退出也保存了）
  fallback 到 practice_record 表

GET /materials (带 JWT) → 每条素材附带 progress 字段:
  { sentenceOrder: 12, totalSentences: 76, percent: 16 }
  无进度记录时 progress = null
```

### 收藏合并策略

```
GET /materials 是公开接口，不含 isFavorited
GET /favorites/my 是 JWT 接口，返回收藏的素材列表

合并方式:
  const [materials, favList] = await Promise.all([
    getMaterials({ status: 'published' }),
    isLoggedIn() ? getMyFavorites() : []
  ])
  const favIds = new Set(favList.map(f => f.id))
  materials.map(m => ({ ...m, isFavorited: favIds.has(m.id) }))

切换收藏后只刷新 favIds，不重新拉素材列表。
```

### 错题移出规则

```
连续2次 score ≥ 80 → 移出错题本
最近1次 ≥ 80 但前1次 < 80 → oneMorePass = true (还差1次)
优先级公式: (100-score)*0.6 + days*0.2 + errorCount*0.2
```

---

## 6. 数据库 Schema

```
Material (素材)
  id            uuid PK
  title         string
  language      string (default 'en')
  accent        string (default 'american')    ← 美式/英式/澳式/商务
  level         string                        ← beginner/intermediate/advanced
  coverUrl      string nullable
  audioUrl      string
  durationMs    integer (default 0)
  status        string (default 'draft')       ← draft/published
  source        string nullable
  audioOffsetMs integer (default 0)
  createdAt     timestamp
  └── sentences[] → Sentence (1:N)

Sentence (句子)
  id            uuid PK
  order         integer
  startTime     float
  endTime       float
  text          text
  translation   string nullable
  audioUrl      string nullable
  → material    ManyToOne
  └── practiceRecords[] → PracticeRecord (1:N)

PracticeRecord (练习记录)
  id            uuid PK
  audioUrl      string nullable
  score         float nullable                ← ASR 评分
  errorWords    string nullable
  durationMs    integer (default 0)
  createdAt     timestamp
  → user        ManyToOne
  → sentence    ManyToOne

Progress (练习进度)                              ← UNIQUE(user, material)
  id            uuid PK
  → user        ManyToOne
  → material    ManyToOne
  sentenceOrder integer                        ← 上次练到第几句
  totalSentences integer                       ← 素材总句数
  updatedAt     timestamp                      ← 自动更新
  createdAt     timestamp

User (用户)
  id            uuid PK
  openid        string unique
  nickname      string nullable
  avatarUrl     string nullable
  preferredLanguage string (default 'en')
  createdAt     timestamp
  └── practiceRecords[] → PracticeRecord (1:N)

AppConfig (应用配置)
  id            uuid PK
  key           string unique                 ← mastery_threshold = 80
  value         string

Favorite (收藏)                                  ← UNIQUE(user, material)
  id            uuid PK
  → user        ManyToOne
  → material    ManyToOne
  createdAt     timestamp
```

---

## 7. API 一览

基础路径：`http://localhost:3000/api`

### 可选鉴权接口（有 JWT 则附带 progress）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/materials` | 素材列表，带 token 时每条附带 progress 字段 |

### 公开接口（无需 JWT）

| Method | Path | 说明 |
|--------|------|------|
| POST | `/auth/login` | 微信登录，返回 JWT |
| GET | `/materials/:id` | 单个素材 |
| GET | `/materials/:id/sentences` | 素材下句子列表 |
| POST | `/admin/materials/import` | 导入素材（multipart） |
| PUT | `/admin/materials/:id/status` | 更新状态 |
| PATCH | `/admin/materials/:id` | 部分更新（accent/level/status） |
| PATCH | `/admin/materials/:id/offset` | 更新音频偏移 |
| PATCH | `/admin/materials/sentences/:id` | 更新句子 |
| DELETE | `/admin/materials/:id` | 删除素材 |

### 需要 JWT 的接口

| Method | Path | 说明 |
|--------|------|------|
| POST | `/practice-records` | 创建练习记录 |
| GET | `/practice-records/my/last-progress` | 最近练习位置（优先查 progress 表） |
| GET | `/practice-records/my/streak` | 打卡统计 |
| GET | `/practice-records/my/stats` | 练习统计 |
| GET | `/practice-records/my/wrong/count` | 错题数量 |
| GET | `/practice-records/my/wrong` | 错题列表 |
| GET | `/practice-records/my` | 练习记录分页 |
| POST | `/progress` | 保存/更新练习进度（upsert） |
| GET | `/progress/:materialId` | 获取某素材的练习进度 |
| POST | `/favorites/:materialId` | 收藏（409 if duplicate） |
| DELETE | `/favorites/:materialId` | 取消收藏 |
| GET | `/favorites/my` | 我的收藏列表 |
| GET | `/users/me` | 用户信息 |

### 筛选参数

`GET /materials?accent=american&level=intermediate&duration=short&status=published`

duration 值：`short`（<5min）、`medium`（5-15min）、`long`（>15min）

### 进度接口

```
POST /progress
  Body: { materialId, sentenceOrder, totalSentences }
  Response: { id, sentenceOrder, totalSentences, updatedAt }

GET /progress/:materialId
  Response: { id, sentenceOrder, totalSentences, updatedAt, createdAt } | null
```

---

## 8. 小程序关键模式

### 跨页面传参

```javascript
// home → materials (筛选条件)
getApp().globalData.pendingFilter = { level: 'beginner' }
wx.switchTab({ url: '/pages/materials/materials' })

// materials → practice (素材ID + 标题)
wx.navigateTo({
  url: `/pages/practice/practice?materialId=${id}&materialTitle=${encodeURIComponent(title)}`
})

// home → practice (续练)
wx.navigateTo({
  url: `/pages/practice/practice?materialId=${id}&startOrder=${order}&materialTitle=${encodeURIComponent(title)}`
})
```

### 进度保存时序

```
进入 practice 页 → 记录 practiceStartTime = Date.now()
自动录音完成 → sessionScores.push(score)
onHide / onUnload → saveProgress(materialId, currentOrder, total)
练完最后一句 → saveProgress(materialId, 1, total) + 显示完成页
点击"重新练" → saveProgress(materialId, 1, total) + _playSentence(0)
```

### 认证流程

```
app.js onLaunch → login() → wx.login → POST /auth/login → 存 token
request.js: 401 → 清 token → 重新 login → 重试原请求
```

### 深色主题常量

```
背景:    #0f0f0f    卡片:    #1a1a1a    强调:    #a8e6cf
文字主:  #ffffff   文字次:  #888888    文字弱:  #555555
初级:    #a8e6cf   中级:    #ffd97d   高级:    #ff9999
收藏:    #e8a87c   边框:    #2a2a2a   提示:    #e8a87c
已完成:  #a8e6cf   完成条:  #a8e6cf
```

---

## 9. 禁止做的事（Anti-Patterns）

| ❌ 绝对不做 | 原因 |
|-------------|------|
| `as any` / `@ts-ignore` | 绕过类型检查，隐藏错误 |
| 静默吞错误 `catch(e) {}` | 用户不知道失败了 |
| `onTimeUpdate` 代替 setInterval | iOS 远程音频不可靠 |
| Timer padding > 200ms | 1s句子+3spadding=300%误差 |
| YouTube 自动字幕做对齐 | 逐词滚动式，负时间戳+100s+片段 |
| 新素材不 SET published | 前端只显示 published，会看不到 |
| `isFavorited` 从 GET /materials 取 | 公开接口不含此字段，必须客户端合并 |
| TypeORM `find()` 不加 `relations` 取 relation 属性 | 返回 proxy 对象，需用 `createQueryBuilder` + `getRawMany()` |

---

## 10. 常见操作

```bash
# 查看所有素材状态
psql -U wang -d shadowing_dev -c "SELECT id, title, status, accent, level FROM material;"

# 批量设为 published
psql -U wang -d shadowing_dev -c "UPDATE material SET status = 'published';"

# 查看错题阈值
psql -U wang -d shadowing_dev -c "SELECT * FROM app_config;"

# 查看用户进度
psql -U wang -d shadowing_dev -c 'SELECT p."sentenceOrder", p."totalSentences", m.title FROM progress p JOIN material m ON p."materialId" = m.id;'

# 清除测试数据
psql -U wang -d shadowing_dev -c "DELETE FROM practice_record; DELETE FROM favorite; DELETE FROM progress;"

# 后端类型检查
cd backend && npx tsc --noEmit

# 管理后台类型检查
cd admin && npx tsc --noEmit

# 小程序 JS 语法检查
node -c miniprogram/pages/home/home.js
```

---

## 11. 版本历史

### v2.1.0 (2026-06-01) — 练习进度保存 + 完成页 + 已完成筛选

**新增**：
- 练习进度保存：onHide/onUnload 自动保存当前句子位置
- Progress 表：user+material 唯一索引，upsert 保存
- POST /progress + GET /progress/:materialId 接口
- GET /materials 带 JWT 时附带 progress 字段（OptionalJwtAuthGuard）
- 素材卡片显示进度条（<95% 绿色百分比，≥95% "已完成 ✓"）
- 练习完成页：🎉 练习完成 + 总句数 + 用时 + 平均分（自动录音）
- "重新练" 按钮：重置进度到第1句重新开始
- "返回" 按钮：navigateBack()
- 素材库"已完成"筛选 toggle（progress≥95%）
- 首页 Hero 3 状态：继续上次 / 重新练 / 去选择
- getLastProgress 优先查 progress 表，fallback 到 practice_record

**修复**：
- getBatchProgress 使用 createQueryBuilder + getRawMany 代替 find(relation)
- onTogglePlay finished 状态不再自动重播

### v2.0.0 (2026-06-01) — 导航重构 + 首页 + 素材库升级

**新增**：
- tabBar 3-tab（训练/素材库/我的），深色主题
- 首页 Hero CTA（继续/推荐/开始），streak条，错题提醒，快速筛选
- 素材库 4维筛选（accent/level/duration/favOnly）+ 搜索 + ♥收藏切换
- 收藏模块（后端 Entity+CRUD + 小程序 Promise.all 合并）
- 续练接口 GET /practice-records/my/last-progress
- practice.js startOrder 参数支持续练
- 管理后台编辑 Modal（accent/level/status）
- Material accent 列（default 'american'）
- duration 筛选（short/medium/long）

**修复**：
- 收藏 409 Conflict：isFavorited 客户端合并，本地刷新

### v1.1.0 (2026-05-31) — 打卡日历

**新增**：
- 打卡+连续天数+3级日历（年/月/日）
- Streak 固定🔥 + 未打卡提示
- 年视图切换箭头

**修复**：
- showCalendar ReferenceError
- 月视图标题重复
- Streak emoji 从条件⏰改为固定🔥

### v1.0.0 (2026-05-29) — 初始版本

- 跟读训练核心：3种模式
- ASR 评分
- 错题本 + 复习系统
- 微信登录 + JWT
- 素材导入（VTT + Whisper）
- React 管理后台
- 1301 句子 100% 翻译