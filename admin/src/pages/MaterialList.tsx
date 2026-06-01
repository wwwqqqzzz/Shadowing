import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Modal, Popconfirm, Select, Space, Spin, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { Material } from '../api/materials'
import { deleteMaterial, getMaterials, updateMaterial, updateStatus } from '../api/materials'
import {
  ACCENT_LABELS,
  formatDuration,
  LEVEL_LABELS,
  LEVEL_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../utils/format'

const { Title } = Typography

const MaterialList: React.FC = () => {
  const navigate = useNavigate()
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm] = Form.useForm()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchMaterials = async () => {
    try {
      setLoading(true)
      const { data } = await getMaterials()
      setMaterials(data)
    } catch {
      message.error('加载素材列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchMaterials()
  }, [])

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'published' ? 'draft' : 'published'
    try {
      await updateStatus(id, nextStatus)
      message.success(nextStatus === 'published' ? '已发布' : '已下架')
      await fetchMaterials()
    } catch {
      message.error('操作失败')
    }
  }

  const handleEdit = (record: Material) => {
    setEditingId(record.id)
    editForm.setFieldsValue({
      accent: record.accent || 'american',
      level: record.level,
      status: record.status,
    })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editingId) return
    try {
      const values = await editForm.validateFields()
      setSaving(true)
      await updateMaterial(editingId, values)
      message.success('已更新')
      setEditOpen(false)
      await fetchMaterials()
    } catch {
      if (saving) message.error('更新失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterial(id)
      message.success('已删除')
      await fetchMaterials()
    } catch {
      message.error('删除失败')
    }
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => <Tag>{source}</Tag>,
    },
    {
      title: '口音',
      dataIndex: 'accent',
      key: 'accent',
      render: (accent: string) => (
        <Tag>{ACCENT_LABELS[accent] ?? accent}</Tag>
      ),
    },
    {
      title: '难度',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => (
        <Tag color={LEVEL_COLORS[level]}>{LEVEL_LABELS[level] ?? level}</Tag>
      ),
    },
    {
      title: '句子数',
      dataIndex: 'sentenceCount',
      key: 'sentenceCount',
    },
    {
      title: '时长',
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: (ms: number) => formatDuration(ms),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status] ?? status}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Material) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              onClick={() => void handleStatusToggle(record.id, record.status)}
            >
              发布
            </Button>
          )}
          {record.status === 'published' && (
            <Button
              type="link"
              size="small"
              onClick={() => void handleStatusToggle(record.id, record.status)}
            >
              下架
            </Button>
          )}
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/edit/${record.id}`)}
          >
            编辑句子
          </Button>
          <Popconfirm
            title="确定删除该素材？"
            onConfirm={() => void handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Spin spinning={loading}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>素材管理</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/import')}>
            导入新素材
          </Button>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={materials}
          pagination={{ pageSize: 20 }}
        />
      </Spin>
      <Modal
        title="编辑素材"
        open={editOpen}
        onOk={() => void handleEditSave()}
        onCancel={() => setEditOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="口音" name="accent" rules={[{ required: true, message: '请选择口音' }]}>
            <Select options={Object.entries(ACCENT_LABELS).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item label="难度" name="level" rules={[{ required: true, message: '请选择难度' }]}>
            <Select options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default MaterialList