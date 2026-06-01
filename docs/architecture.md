# Shadowing 影子跟读 — 架构文档

> 最后更新：2026-06-01

## 系统架构

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  微信小程序   │────▶│  NestJS API  │────▶│  PostgreSQL  │
│  (WXML+WXSS) │     │  localhost:   │     │  shadowing_  │
│  端口: 无     │     │  3000/api     │     │  dev         │
└──────────────┘     └──────┬───────┘     └──────────────┘
                           │
                     ┌─────┴─────┐
                     │  Whisper   │
                     │  ASR (CPU) │
                     └───────────┘

┌──────────────┐
│  React 管理台 │────▶ NestJS API
│  Ant Design  │     (同上)
│  端口: 5173   │
└──────────────┘
```

## 目录结构

```
Shadowing/
├── miniprogram/          # 微信小程序前端
│   ├── pages/            # 7 页面
│   │   ├── home/         # 训练首页 (tabBar 第1项)
│   │   ├── materials/    # 素材库 (tabBar 第2项)
│   │   ├── profile/      # 我的 (tabBar 第3项)
│   │   ├── practice/     # 跟读训练 (核心页面)
│   │   ├── wrong-book/   # 错题列表
│   │   ├── wrong-review/ # 错题复习
│   │   └── settings/     # 练习模式选择
│   ├── components/       # player/recorder/subtitle (未注册)
│   ├── utils/            # api/auth/format/request/util
│   ├── mock/             # Phase 0 mock 数据
│   └── app.js/json/wxss  # 全局配置
│
├── backend/              # NestJS 后端
│   └── src/
│       ├── auth/         # wx.login mock → JWT
│       ├── materials/    # 素材 CRUD + admin 导入 + accent/duration 过滤
│       │   ├── entities/material.entity.ts
│       │   ├── materials.service.ts
│       │   ├── materials.controller.ts      # 公开 GET
│       │   └── admin-materials.controller.ts  # admin 管理
│       ├── sentences/     # 句子实体 (无 controller)
│       ├── practice-records/ # 练习记录 + stats + streak + wrong + last-progress
│       ├── users/         # 用户 profile
│       ├── favorites/     # 收藏 CRUD (POST/DELETE/GET)
│       ├── asr/           # Whisper 转写 + 评分
│       ├── config/        # 数据库配置 (ConfigService)
│       └── app-config/    # AppConfig 键值存储 (mastery_threshold)
│
├── admin/                # React 管理后台
│   └── src/
│       ├── pages/MaterialList.tsx   # 素材列表 + 编辑 Modal
│       ├── pages/ImportMaterial.tsx # 素材导入
│       ├── api/materials.ts        # API 封装
│       └── utils/format.ts         # LEVEL/ACCENT/STATUS 标签
│
├── scripts/              # 工具脚本
│   ├── import-material.js   # 素材导入
│   ├── align_sentences.py   # Whisper 对齐
│   ├── fix_algorithms.py    # 算法修复
│   └── translate_sentences.py # 翻译
│
└── docs/                  # 项目文档
```

## 数据库 Schema

```
Material (素材)
├── id (uuid, PK)
├── title (string)
├── language (string, default 'en')
├── accent (string, default 'american')     ← 新增
├── level (string)                          ← beginner/intermediate/advanced
├── coverUrl (string, nullable)
├── audioUrl (string)
├── durationMs (integer, default 0)
├── status (string, default 'draft')        ← draft/published
├── source (string, nullable)
├── audioOffsetMs (integer, default 0)
├── createdAt (timestamp)
└── sentences[] → Sentence

Sentence (句子)
├── id (uuid, PK)
├── order (integer)
├── startTime (float)
├── endTime (float)
├── text (text)
├── translation (string, nullable)
├── audioUrl (string, nullable)
├── → material (ManyToOne)
└── → practiceRecords[] (OneToMany)

PracticeRecord (练习记录)
├── id (uuid, PK)
├── audioUrl (string, nullable)
├── score (float, nullable)
├── errorWords (string, nullable)
├── durationMs (integer, default 0)
├── createdAt (timestamp)
├── → user (ManyToOne)
└── → sentence (ManyToOne)

User (用户)
├── id (uuid, PK)
├── openid (string, unique)
├── nickname (string, nullable)
├── avatarUrl (string, nullable)
├── preferredLanguage (string, default 'en')
├── createdAt (timestamp)
└── → practiceRecords[] (OneToMany)

AppConfig (应用配置)
├── id (uuid, PK)
├── key (string, unique)
└── value (string)
    └── mastery_threshold = 80  ← 错题移出阈值

Favorite (收藏)                        ← 新增
├── id (uuid, PK)
├── → user (ManyToOne)
├── → material (ManyToOne)
├── createdAt (timestamp)
└── UNIQUE(user, material)             ← 防重复
```

## 认证流程

```
微信 wx.login() → code
         │
         ▼
POST /api/auth/login { code }
         │
         ▼
后端: code → openid (mock) → 查找或创建 User → 生成 JWT
         │
         ▼
小程序: 存 token 到 wx.setStorageSync('token')
         │
         ▼
后续请求: header.Authorization = 'Bearer ' + token
         │
         ▼
401 → 自动重新登录 → 重试原请求
```

## 关键设计决策

| 决策 | 原因 |
|------|------|
| GET /materials 公开，不含 isFavorited | 公开接口可缓存，收藏数据用户级，前端 Promise.all 合并 |
| wx.createInnerAudioContext + setInterval 轮询 | iOS 远程音频 onTimeUpdate 不可靠 |
| 错题移出需连续2次≥80 | 1次高分可能是运气，2次确认掌握 |
| TypeORM synchronize: true 始终开启 | 开发阶段方便，生产需条件化 |
| 收藏 POST 返回 409 时前端不报错 | 本地先合并 isFavorited，避免重复点 |
| startOrder 参数而非 startSentenceId | 前端用 order 更直观，后端 findIndex 简单 |