# Shadowing — API 参考文档

> 最后更新：2026-06-01
> 基础路径：`http://localhost:3000/api`

## 认证

需要 JWT 的接口在 Header 中传 `Authorization: Bearer <token>`。

---

## 素材 Materials

### GET /materials

获取素材列表（公开接口，无需认证）。

**Query 参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | `published`（默认）、`draft` |
| language | string | 如 `en` |
| level | string | `beginner`、`intermediate`、`advanced` |
| accent | string | `american`、`british`、`australian`、`business` |
| duration | string | `short`（<5min）、`medium`（5-15min）、`long`（>15min） |

**响应：**
```json
[
  {
    "id": "uuid",
    "title": "Rachel's English",
    "language": "en",
    "accent": "american",
    "level": "intermediate",
    "coverUrl": null,
    "audioUrl": "audio.mp3",
    "durationMs": 480000,
    "audioOffsetMs": 0,
    "status": "published",
    "source": "YouTube",
    "sentenceCount": 76,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

注意：此接口不含 `isFavorited`。需认证的收藏状态通过 `GET /favorites/my` 单独获取。

### GET /materials/:id

获取单个素材详情。

### GET /materials/:id/sentences

获取素材下所有句子，按 order 排序。

**响应：**
```json
[
  {
    "id": "uuid",
    "order": 1,
    "startTime": 0.5,
    "endTime": 3.2,
    "text": "Hello, welcome to this lesson.",
    "translation": "你好，欢迎来到这节课。",
    "audioUrl": null
  }
]
```

---

## 管理 Admin Materials

### POST /admin/materials/import

导入新素材（multipart，含 audioFile + vttFile）。

### PATCH /admin/materials/:id

更新素材属性。

**Body：**
```json
{ "accent": "british", "level": "advanced", "status": "published" }
```

### PUT /admin/materials/:id/status

更新素材状态。

### PATCH /admin/materials/:id/offset

更新音频偏移。

### PATCH /admin/materials/sentences/:id

更新句子。

### DELETE /admin/materials/:id

删除素材。

---

## 练习记录 Practice Records

所有接口需要 JWT 认证。

### POST /practice-records

创建练习记录。

**Body：**
```json
{ "sentenceId": "uuid", "durationMs": 3500 }
```

### GET /practice-records/my/last-progress

获取用户最近练习位置，用于「继续上次」功能。

**响应：**
```json
{
  "material": {
    "id": "uuid",
    "title": "Rachel's English",
    "audioUrl": "audio.mp3",
    "level": "intermediate",
    "accent": "american",
    "source": "YouTube",
    "totalSentences": 76
  },
  "lastSentenceOrder": 12,
  "totalSentences": 76,
  "progressPercent": 15
}
```

新用户返回 `null`。

### GET /practice-records/my/streak

打卡统计。

**响应：**
```json
{
  "currentStreak": 7,
  "longestStreak": 14,
  "totalDays": 30,
  "todayDone": true,
  "calendarDates": ["2026-05-20", "2026-05-21", ...]
}
```

### GET /practice-records/my/stats

练习统计。

**响应：**
```json
{
  "totalSentences": 120,
  "totalDurationMs": 3600000,
  "currentStreak": 7,
  "todayDone": true,
  "recentRecords": [...]
}
```

### GET /practice-records/my/wrong/count

错题数量。

### GET /practice-records/my/wrong

错题列表（按优先级排序）。

**响应：**
```json
{
  "total": 23,
  "items": [
    {
      "sentenceId": "uuid",
      "sentence": { "text": "...", "translation": "...", "startTime": 1.2, "endTime": 3.5 },
      "latestScore": 45,
      "errorCount": 5,
      "daysSinceLastReview": 3,
      "priority": 61.0,
      "oneMorePass": false,
      "lastPracticeAt": "2026-05-28T..."
    }
  ]
}
```

### GET /practice-records/my

分页获取练习记录。

**Query 参数：** `limit`（默认20，最大100）、`offset`

---

## 收藏 Favorites

所有接口需要 JWT 认证。

### POST /favorites/:materialId

收藏素材。已收藏返回 409 Conflict。

### DELETE /favorites/:materialId

取消收藏。

### GET /favorites/my

获取我的收藏列表（返回 Material 对象数组）。

**响应：**
```json
[
  {
    "id": "uuid",
    "title": "Rachel's English",
    "level": "intermediate",
    ...
  }
]
```

---

## 用户 Users

### GET /users/me

获取当前用户 profile。需要 JWT。

---

## ASR 评测

### POST /asr/evaluate

上传录音文件，返回评分。

**Content-Type：** `multipart/form-data`
**字段：** `audio`（录音文件）、`sentenceId`

---

## 认证 Auth

### POST /auth/login

微信登录。

**Body：**
```json
{ "code": "wx.login返回的code" }
```

**响应：**
```json
{
  "token": "jwt-token-here",
  "user": { "id": "uuid", "openid": "...", "nickname": null }
}
```

---

## 错误响应

| HTTP 状态码 | 含义 |
|------------|------|
| 401 | JWT 过期或无效，小程序端自动重新登录 |
| 404 | 资源不存在（Material/Sentence/User） |
| 409 | 冲突（如重复收藏） |
| 500 | 服务器内部错误 |