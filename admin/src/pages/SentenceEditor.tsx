import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, InputNumber, Space, Spin, Table, Typography, message, Slider } from 'antd'
import { ArrowLeftOutlined, SaveOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { getSentences, updateSentence, getMaterials, updateMaterialOffset } from '../api/materials'
import type { Sentence, Material } from '../api/materials'

const { Title, Text } = Typography

const API_BASE = 'http://localhost:3000/api'

const SentenceEditor: React.FC = () => {
  const { materialId } = useParams()
  const navigate = useNavigate()
  const [material, setMaterial] = useState<Material | null>(null)
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [audioOffset, setAudioOffset] = useState(0)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const fetchData = async () => {
    if (!materialId) return
    try {
      setLoading(true)
      const [matRes, sentRes] = await Promise.all([
        getMaterials(),
        getSentences(materialId),
      ])
      const mat = matRes.data.find((m) => m.id === materialId)
      setMaterial(mat ?? null)
      if (mat) setAudioOffset(mat.audioOffsetMs ?? 0)
      const sorted = sentRes.data.sort((a, b) => a.order - b.order)
      setSentences(sorted)
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }
  }, [materialId])

  const handleSave = async (sentence: Sentence) => {
    setSavingId(sentence.id)
    try {
      await updateSentence(sentence.id, {
        startTime: sentence.startTime,
        endTime: sentence.endTime,
        text: sentence.text,
        audioUrl: sentence.audioUrl,
      })
      message.success(`句子 #${sentence.order} 已保存`)
    } catch {
      message.error('保存失败')
    } finally {
      setSavingId(null)
    }
  }

  const handleSaveOffset = async () => {
    if (!material) return
    try {
      await updateMaterialOffset(material.id, audioOffset)
      message.success(`偏移量已保存: ${audioOffset}ms`)
    } catch {
      message.error('保存偏移量失败')
    }
  }

  const handlePlay = (sentence: Sentence) => {
    if (!material?.audioUrl) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (playingId === sentence.id) { setPlayingId(null); return }

    const audio = new Audio(`${API_BASE}/audio/${material.audioUrl}`)
    audio.currentTime = (sentence.startTime + audioOffset) / 1000
    const endTime = (sentence.endTime + audioOffset) / 1000
    audio.onended = () => setPlayingId(null)
    audio.ontimeupdate = () => {
      if (audio.currentTime >= endTime - 0.05) { audio.pause(); setPlayingId(null) }
    }
    audio.play().catch(() => message.error('播放失败'))
    audioRef.current = audio
    setPlayingId(sentence.id)
  }

  const columns = [
    {
      title: '#',
      dataIndex: 'order',
      key: 'order',
      width: 50,
    },
    {
      title: '▶',
      key: 'play',
      width: 50,
      render: (_: unknown, record: Sentence) => (
        <PlayCircleOutlined
          style={{ cursor: 'pointer', color: playingId === record.id ? '#1890ff' : '#999', fontSize: 18 }}
          onClick={() => handlePlay(record)}
        />
      ),
    },
    {
      title: '开始 (ms)',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 110,
      render: (_: unknown, record: Sentence) => (
        <InputNumber
          value={record.startTime}
          min={0}
          style={{ width: 100 }}
          onChange={(val) => {
            if (val === null) return
            setSentences((prev) =>
              prev.map((s) => (s.id === record.id ? { ...s, startTime: val } : s)),
            )
          }}
        />
      ),
    },
    {
      title: '结束 (ms)',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 110,
      render: (_: unknown, record: Sentence) => (
        <InputNumber
          value={record.endTime}
          min={0}
          style={{ width: 100 }}
          onChange={(val) => {
            if (val === null) return
            setSentences((prev) =>
              prev.map((s) => (s.id === record.id ? { ...s, endTime: val } : s)),
            )
          }}
        />
      ),
    },
    {
      title: '时长',
      key: 'duration',
      width: 70,
      render: (_: unknown, record: Sentence) => {
        const dur = ((record.endTime - record.startTime) / 1000).toFixed(1)
        return <Text type="secondary">{dur}s</Text>
      },
    },
    {
      title: '文本',
      dataIndex: 'text',
      key: 'text',
      render: (_: unknown, record: Sentence) => (
        <Input.TextArea
          value={record.text}
          rows={2}
          onChange={(e) => {
            setSentences((prev) =>
              prev.map((s) => (s.id === record.id ? { ...s, text: e.target.value } : s)),
            )
          }}
        />
      ),
    },
    {
      title: '保存',
      key: 'actions',
      width: 70,
      render: (_: unknown, record: Sentence) => (
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          loading={savingId === record.id}
          onClick={() => void handleSave(record)}
        />
      ),
    },
  ]

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {material ? `编辑句子 — ${material.title}` : '句子编辑'}
        </Title>
      </div>

      <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <Text strong>音频偏移 (audioOffsetMs): </Text>
        <Text type="secondary" style={{ marginRight: 12 }}>
          BBC 音频开头有 promo，VTT 时间戳需要加上此偏移
        </Text>
        <Space>
          <Slider
            min={0}
            max={10000}
            step={100}
            value={audioOffset}
            onChange={setAudioOffset}
            style={{ width: 300, display: 'inline-block', verticalAlign: 'middle' }}
          />
          <InputNumber
            value={audioOffset}
            min={0}
            max={30000}
            step={100}
            style={{ width: 100 }}
            onChange={(val) => val !== null && setAudioOffset(val)}
          />
          <span style={{ marginRight: 8 }}>{(audioOffset / 1000).toFixed(1)}s</span>
          <Button type="primary" size="small" onClick={() => void handleSaveOffset()}>
            保存偏移
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={sentences}
        pagination={false}
        size="small"
        bordered
      />
    </Spin>
  )
}

export default SentenceEditor