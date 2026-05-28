# Shadowing 影子跟读微信小程序

## 项目定位

围绕 shadowing（影子跟读）训练流程构建的轻量语言训练系统。
核心目标：让用户低门槛开始跟读训练，在训练过程中获得明确反馈。

产品不是语言播放器，不是 AI 学习平台。
最重要的是训练闭环是否顺滑：播放一句 → 自动暂停 → 用户跟读 → 下一句。

## 技术栈

| 层级     | 技术                                           |
| -------- | ---------------------------------------------- |
| 小程序端 | 原生微信小程序（不使用 uniapp 或其他跨端框架） |
| 后端 API | NestJS                                         |
| 数据库   | PostgreSQL                                     |
| 素材处理 | ffmpeg（独立服务，不污染业务服务）             |
| AI 服务  | ASR + 文本比对（Phase 3 才引入）               |

## 核心数据模型

```
Material（素材）
  └── Sentence（句子）← 系统核心实体
        └── PracticeRecord（训练记录）
```

**Sentence 字段（最重要）**

* `startTime` / `endTime`：时间轴，精确到毫秒
* `text`：原文
* `translation`：译文
* `order`：排序

**PracticeRecord 字段**

* `userId` / `sentenceId`
* `audioUrl`：录音文件
* `score`：评分（Phase 3 才有意义）
* `errorWords`：识别错误词
* `duration`：训练时长

## 页面结构

```
pages/
  home/          首页（今日推荐、最近练习、分类入口）
  materials/     素材列表（难度筛选、时长筛选）
  practice/      跟读训练页 ← 开发重点
  profile/       个人中心（训练记录、累计时长、收藏）
components/
  subtitle/      字幕组件
  player/        播放控制组件
  recorder/      录音组件
utils/
mock/            Phase 0 本地测试数据
```

底部导航：首页 / 素材 / 我的（三个 tab）

## 跟读训练页核心功能（practice 页）

必须具备（V1 上线前）：

* 字幕逐句高亮（当前句突出显示）
* 音频播放 / 暂停 / 跳句
* **自动暂停** （每句播放完自动停，等待用户跟读）
* 变速播放（0.5x / 0.75x / 1x）
* 单句循环
* 字幕显示 / 隐藏切换
* 录音跟读
* 录音回放对比
* 训练进度记录

暂不做（V2 后加）：

* 发音评分（讯飞 API）
* 生词点击查词
* 打卡分享
* 用户上传素材

## 开发阶段

### 当前阶段：Phase 0（原型验证）

**目标：只验证跟读节奏是否舒服，不接后端。**

* 使用 `mock/` 下的本地数据（本地 mp3 + 手写时间轴 JSON）
* 不需要用户登录
* 不需要数据库
* 不需要后端 API
* 重点验证：自动暂停节奏、字幕高亮、单句循环体验、变速播放

Phase 0 完成标准：用户能自然地连续跟读 10 分钟不感到卡顿。

### Phase 1（最小可运行系统）

接入后端，完整流程闭环：

* 微信登录 + JWT 鉴权
* 素材 / 句子接口
* 训练记录写入
* 后台管理（素材导入、字幕管理、句子编辑）

### Phase 2（素材处理系统）

字幕导入 → 自动切句 → 时间轴修正 → 音频切片
素材来源：YouTube 字幕、VOA、BBC Learning English、TED-Ed

### Phase 3（轻量 AI 反馈）

录音 → ASR 转文字 → 与原句比对 → 返回错误词 + 流利度
暂不做专业发音工程（音素对齐、重音、韵律）

## 开发规范

**每次只做一件事。** 不要在一个 PR 里混入多个功能模块。

 **小程序端不做复杂逻辑** ，以下功能必须放服务端：

* 音频处理 / 转码
* 字幕切分
* AI 推理

 **音频相关 API 注意事项** ：

* 播放使用 `wx.createInnerAudioContext()`
* 录音使用 `wx.getRecorderManager()`（全局单例，注意生命周期）
* 后台播放需在 `app.json` 声明 `"requiredBackgroundModes": ["audio"]`
* 蓝牙耳机兼容性需单独测试

 **禁止做的事** （防止范围蔓延）：

* 不做背单词模块
* 不做 AI 对话
* 不做社区 / 社交功能
* 不做排行榜
* 每次想加新功能前，先问：这个功能是否直接提升用户开口训练？

## Mock 数据格式（Phase 0）

```json
{
  "material": {
    "id": "mock-001",
    "title": "TED: The power of vulnerability",
    "language": "en",
    "level": "intermediate",
    "audioUrl": "/mock/audio/sample.mp3"
  },
  "sentences": [
    {
      "id": "s001",
      "startTime": 1200,
      "endTime": 4800,
      "text": "So, I'll start with a quote.",
      "translation": "那么，我先从一句引言开始。",
      "order": 1
    }
  ]
}
```

时间单位：毫秒（ms）

## 后台管理系统（Phase 1 配套）

最重要的后台功能：

1. 素材上传 + 字幕导入（srt / vtt）
2. 句子时间轴人工调整（字幕切得不好，训练体验会非常差）
3. 难度设置 + 发布状态管理

后台技术栈：React + Ant Design（独立 Web 应用，不在小程序内）

## 第一阶段判断标准

1. 不是 AI 是否先进，而是：**用户是否真的愿意连续练 10 分钟。**
