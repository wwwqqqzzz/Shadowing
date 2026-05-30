import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popconfirm, Space, Spin, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { Material } from '../api/materials'
import { deleteMaterial, getMaterials, updateStatus } from '../api/materials'
import {
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
  )
}

export default MaterialList