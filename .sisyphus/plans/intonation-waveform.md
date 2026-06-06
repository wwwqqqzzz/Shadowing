# 语调波形 (Intonation Waveform)

## 目标
原音 vs 用户录音的 pitch 轮廓对比显示，让用户看到语调差异。

## 依赖
- 后端 Python 音频处理 (librosa/pyworld 提取 F0 contour)
- 小程序 Canvas 渲染
- Sentence 实体加 `pitchData` JSON 列存储原音 pitch

## 实现步骤

### Step 1: 后端 pitch 提取接口
- 给 Sentence 表加 `pitchData` 列 (JSON: [{time, frequency}])
- 批量回填所有现有句子：提取各句对应音频片段的 pitch contour
- 新增 `POST /api/audio/analyze-pitch` 接口：接收用户录音 → 提取 pitch → 与原句 pitch 对齐 → 返回对比数据
- 复用 asr-service 或新建端点（用 librosa pyworld）

### Step 2: 小程序 canvas 渲染
- 在 practice 完成态下方加 canvas 区域
- 绘制两条 pitch 曲线：原音（品牌色）+ 用户（对比色）
- 时间轴对齐，标注差异区域
- 支持横滑查看长句

### Step 3: 接入练习流程
- 自动录音模式：评分后显示波形对比
- 影子模式完成态：显示波形对比
- 点击波形可以切换原音/自己/叠加视图

## 文件清单
| 文件 | 改动 |
|------|------|
| backend/src/sentences/entities/sentence.entity.ts | 加 pitchData 列 |
| asr-service/ 或 新 service | pitch 提取端点 |
| miniprogram/utils/api.js | 加 analyzePitch API |
| miniprogram/pages/practice/practice.wxml | 加 canvas 区域 |
| miniprogram/pages/practice/practice.wxss | canvas 样式 |
| miniprogram/pages/practice/practice.js | 调用 analyze + canvas 绘制 |
