# Shadowing 影子跟读 — Project Knowledge Base

**Generated:** 2026-05-29
**Branch:** (no git branch detected)

## OVERVIEW

Shadowing 跟读训练系统：微信小程序 + NestJS 后端 + React 管理后台。
围绕「播放一句 → 自动暂停 → 用户跟读 → 下一句」闭环设计。当前 Phase 0（原型验证）。

## STRUCTURE

```
Shadowing/
├── miniprogram/      # 原生微信小程序 (WXML+WXSS+JS)
│   ├── pages/       # 4 页面: home/materials/practice/profile
│   ├── components/  # 3 自定义组件: player/recorder/subtitle
│   ├── utils/       # API封装/登录/请求/格式化
│   └── mock/        # Phase 0 本地 mock 数据
├── backend/         # NestJS API (TypeScript)
│   └── src/         # 6 模块: auth/materials/sentences/...
├── admin/           # React + Ant Design 后台管理
│   └── src/         # 2 页面: MaterialList/ImportMaterial
├── docs/            # 产品规范
└── tmp/             # 临时媒体处理目录
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| 跟读训练核心逻辑 | `miniprogram/pages/practice/practice.js` | 332 行单体，含自动暂停/录音/回放 |
| 后端路由定义 | `backend/src/*/*.controller.ts` | 5 controllers，全局 /api 前缀 |
| 数据库实体 | `backend/src/*/entities/*.entity.ts` | 4 entities: Material/Sentence/PracticeRecord/User |
| 后端服务层 | `backend/src/*/*.service.ts` | 6 services |
| 后台管理页面 | `admin/src/pages/` | MaterialList + ImportMaterial |
| 小程序 API 封装 | `miniprogram/utils/api.js` | 后端 API 调用封装 |
| 鉴权流程 | `miniprogram/utils/auth.js` + `backend/src/auth/` | JWT + wx.login |
| Mock 数据 | `miniprogram/mock/data.js` | Phase 0 素材+句子数据 |

## CONVENTIONS

### 非标准约定（与行业默认不同）

- **后端 `noImplicitAny: false`** — 允许隐式 any 类型，ESLint 也关闭了 `no-explicit-any`
- **小程序 tabBar 仅 2 tab** — 文档说 3 tab（首页/素材/我的），实际只有素材和我的
- **自定义组件存在但未注册** — player/recorder/subtitle 组件已创建，但没有任何页面通过 `usingComponents` 引用
- **E2E 测试** — 仅有 `test/app.e2e-spec.ts` 一个文件，无单元测试（无 `.spec.ts`）
- **TypeORM `synchronize: true` 始终开启** — 生产环境需改成条件配置
- **JWT secret 直接从 `process.env` 读取** — 与数据库配置使用 ConfigService 的方式不一致

### 技术选型

- 小程序播放: `wx.createInnerAudioContext()`
- 录音: `wx.getRecorderManager()`（全局单例）
- 后端 ORM: TypeORM + PostgreSQL
- 鉴权: passport-jwt
- 后台: React 19 + Ant Design 6 + Vite 8 + TypeScript 6.0
- ASR 对齐: OpenAI Whisper `base` model (CPU)
- 素材下载: yt-dlp (MP3 + 手写字幕)
- 两条对齐管道: VTT→Whisper 对齐 (有手写字幕) / Whisper-only (无字幕/自动字幕)

## ANTI-PATTERNS（该项目内禁止）

| 模式 | 说明 | 位置 |
|------|------|------|
| `as any` 类型断言 | TypeORM 关系类型绕过 | `practice-records.service.ts:15-16` |
| 静默吞错误 | catch 只 console.warn 但不通知用户 | `api.js:14`, `profile.js:25`, `practice.js:51` |
| 硬编码 API URL | localhost:3000 硬编码 | `request.js:1`, `admin/api/materials.ts:3` |
| 跳转不存在页面 | request.js 导航到未注册的 /pages/login/login | `request.js:18` |
| 孤立模块 | SentencesService 被导出但从未被使用 | `sentences/` 整个目录 |
| 重复代码 | scripts/import-material.ts 内联了 vtt-parser 完整实现 | `scripts/import-material.ts` |
| ⚠️ 微信 onTimeUpdate 不可靠 | 不能用 `ac.onTimeUpdate()` 做播放边界检测——iOS 远程音频可能不触发或 currentTime 返回错误值。必须用 `setInterval(100ms)` 轮询 | `practice.js` seek 模式 |
| ⚠️ Timer padding 是绝对值陷阱 | 后备 timer 不要加超过 200ms 的固定 padding。1s 句子 + 3s padding = 300% 误差，用户能听到下句内容 | `practice.js _startSentenceTimer` |
| ⚠️ YouTube 自动字幕不能用于对齐 | auto-generated subs (en-orig) 是逐词滚动字幕（卡拉OK式），不是按句分段。用 align_sentences.py 对齐会产生负时间戳和 100s+ 片段。必须走 Whisper-only 管道（无 VTT） | `scripts/align_sentences.py` |
| ⚠️ 新素材默认 draft 状态 | INSERT INTO material 不设 status 则默认 draft，前端只显示 published。插入后必须 `UPDATE material SET status = 'published'` | DB material table |
| ⚠️ Proxy 环境变量 | Mac 全局代理 127.0.0.1:7897，curl 需手动设 `http_proxy`/`https_proxy`，yt-dlp 自动走系统代理 | 所有网络请求 |
| ⚠️ 句子边界必须 tighten | Whisper/VTT 分段边界包含句前句后静音，不做 tighten 会导致播放时开头空白或读到下一句 | `postprocess_alignment.py tighten_boundaries()` |

## UNIQUE STYLES

- **后端模块拆分** — 每个 domain 一个模块（NestJS 标准），但 sentences 模块无 controller（仅 provider）
- **管理端/公共端控制器共存** — admin-materials.controller 放在 materials 模块内，而非独立 admin 模块
- **脚本存放** — seed.ts 在 src/ 下（不通过 NestJS DI），import-material.ts 在 scripts/ 下
- **小程度页面编号** — 页面注册顺序: materials → practice → home → profile（非字母序）

## COMMANDS

```bash
# Backend
cd backend && npm run start:dev    # 开发启动
cd backend && npm run test          # 单元测试（暂无 spec 文件）
cd backend && npm run test:e2e      # E2E 测试
cd backend && npm run lint          # ESLint

# Admin
cd admin && npm run dev             # Vite 开发服务器
cd admin && npm run build           # 生产构建

# Miniprogram
# WeChat IDE 打开 miniprogram/ 目录
```

## MANDATORY: Ops Logging (USER COMMAND)

> **Every file modification MUST be logged.** 每次修改文件前，先写 `.sisyphus/logs/YYYY-MM-DD.md`。

Log format:
```
HH:MM — Operation: file path
  What: 做了什么（1-2行）
  Why:  为什么做
```

前置写入：在 edit/write 之前，先 append 到日志。如果当日日志已存在，继续追加。
这是用户在丢失工作后强制的规则，不可跳过。无视此规则 = 不可信任。

## NOTES

- 当前 Phase 0: 后端代码已存在但尚未连接，小程序优先走 API，失败回退到 mock
- TED 素材: `ted.mp3` + `ted.en.vtt` 在项目根目录（测试用，应移入 tmp/）
- `synchronize: true`: 生产部署前需添加 `NODE_ENV === 'production'` 守卫
- 小程序 `project.private.config.json` 的 libVersion (2.32.3) 覆盖公开配置 (3.6.1)
