import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, InputNumber, Space, Spin, Table, Typography, message } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { getSentences, updateSentence, getMaterials } from '../api/materials'
import type { Sentence, Material } from '../api/materials'

const { Title } = Typography

const SentenceEditor: React.FC = () => {
  const { materialId } = useParams()
  const navigate = useNavigate()
  const [material, setMaterial] = useState<Material | null>(null)
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

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

  const columns = [
    {
      title: '#',
      dataIndex: 'order',
      key: 'order',
      width: 60,
    },
    {
      title: '开始 (ms)',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 120,
      render: (_: unknown, record: Sentence) => (
        <InputNumber
          value={record.startTime}
          min={0}
          style={{ width: 110 }}
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
      width: 120,
      render: (_: unknown, record: Sentence) => (
        <InputNumber
          value={record.endTime}
          min={0}
          style={{ width: 110 }}
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
      title: '音频',
      dataIndex: 'audioUrl',
      key: 'audioUrl',
      width: 160,
      render: (_: unknown, record: Sentence) => (
        <Input
          value={record.audioUrl ?? ''}
          placeholder="自动"
          onChange={(e) => {
            setSentences((prev) =>
              prev.map((s) => (s.id === record.id ? { ...s, audioUrl: e.target.value || null } : s)),
            )
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {material ? `编辑句子 — ${material.title}` : '句子编辑'}
        </Title>
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
