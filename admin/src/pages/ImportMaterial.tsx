import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Typography,
  Upload,
  message,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { ImportResult } from '../api/materials'
import { importMaterial, updateStatus } from '../api/materials'
import { formatDuration, formatTimestamp } from '../utils/format'

const { Title, Text } = Typography

const ImportMaterial: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [vttFile, setVttFile] = useState<File | null>(null)

  const handleImport = async () => {
    try {
      await form.validateFields()
    } catch {
      return
    }

    if (!audioFile) {
      message.error('请选择音频文件')
      return
    }

    const formData = new FormData()
    formData.append('title', form.getFieldValue('title'))
    formData.append('source', form.getFieldValue('source') ?? '')
    formData.append('level', form.getFieldValue('level'))
    formData.append('audioFile', audioFile)
    if (vttFile) {
      formData.append('vttFile', vttFile)
    }

    setLoading(true)
    try {
      const { data } = await importMaterial(formData)
      setResult(data)
      setCurrent(1)
      message.success('导入成功')
    } catch {
      message.error('导入失败，请检查文件格式')
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!result) return
    try {
      await updateStatus(result.materialId, 'published')
      message.success('素材已发布')
      goToComplete()
    } catch {
      message.error('发布失败')
    }
  }

  const goToComplete = () => {
    setCurrent(2)
  }

  const handleReset = () => {
    setCurrent(0)
    setResult(null)
    setAudioFile(null)
    setVttFile(null)
    form.resetFields()
  }

  const previewColumns = [
    {
      title: '序号',
      dataIndex: 'order',
      key: 'order',
      width: 80,
    },
    {
      title: '时间戳',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 100,
      render: (ms: number) => formatTimestamp(ms),
    },
    {
      title: '文本',
      dataIndex: 'text',
      key: 'text',
      render: (text: string) => text.slice(0, 60),
    },
  ]

  const items = [
    { title: '填写信息' },
    { title: '预览结果' },
    { title: '完成' },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>导入新素材</Title>

      <Steps current={current} items={items} style={{ marginBottom: 32 }} />

      <Spin spinning={loading}>
        {current === 0 && (
          <Form
            form={form}
            layout="vertical"
            initialValues={{ level: 'intermediate' }}
          >
            <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
              <Input placeholder="素材标题" />
            </Form.Item>

            <Form.Item label="来源" name="source">
              <Input placeholder="TED / VOA / BBC" />
            </Form.Item>

            <Form.Item label="难度" name="level" rules={[{ required: true, message: '请选择难度' }]}>
              <Select
                options={[
                  { value: 'beginner', label: '入门' },
                  { value: 'intermediate', label: '中级' },
                  { value: 'advanced', label: '高级' },
                ]}
              />
            </Form.Item>

            <Form.Item label="音频文件" required>
              <Upload
                accept=".mp3"
                maxCount={1}
                beforeUpload={(file) => {
                  setAudioFile(file)
                  return false
                }}
                onRemove={() => setAudioFile(null)}
                fileList={audioFile ? [{
                  uid: '-1',
                  name: audioFile.name,
                  status: 'done' as const,
                }] : []}
              >
                <Button icon={<UploadOutlined />}>选择音频 (MP3)</Button>
              </Upload>
            </Form.Item>

            <Form.Item label="字幕文件">
              <Upload
                accept=".vtt,.srt"
                maxCount={1}
                beforeUpload={(file) => {
                  setVttFile(file)
                  return false
                }}
                onRemove={() => setVttFile(null)}
                fileList={vttFile ? [{
                  uid: '-2',
                  name: vttFile.name,
                  status: 'done' as const,
                }] : []}
              >
                <Button icon={<UploadOutlined />}>选择字幕 (VTT / SRT)</Button>
              </Upload>
            </Form.Item>

            <Form.Item>
              <Button type="primary" onClick={() => void handleImport()}>
                开始导入
              </Button>
            </Form.Item>
          </Form>
        )}

        {current === 1 && result && (
          <div>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card>
                  <Text type="secondary">句子总数</Text>
                  <Title level={2} style={{ margin: '8px 0 0' }}>
                    {result.sentenceCount}
                  </Title>
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Text type="secondary">时长</Text>
                  <Title level={2} style={{ margin: '8px 0 0' }}>
                    {formatDuration(result.durationMs)}
                  </Title>
                </Card>
              </Col>
            </Row>

            <Title level={5}>句子预览（前 5 条）</Title>
            <Table
              rowKey="order"
              columns={previewColumns}
              dataSource={result.preview.slice(0, 5)}
              pagination={false}
              size="small"
              style={{ marginBottom: 24 }}
            />

            <Space>
              <Button type="primary" onClick={() => void handlePublish()}>
                发布素材
              </Button>
              <Button onClick={goToComplete}>存为草稿</Button>
            </Space>
          </div>
        )}

        {current === 2 && (
          <Result
            status="success"
            title="导入完成"
            subTitle="素材已成功导入系统"
            extra={[
              <Button key="list" type="primary" onClick={() => navigate('/')}>
                查看素材列表
              </Button>,
              <Button key="again" onClick={handleReset}>
                继续导入
              </Button>,
            ]}
          />
        )}
      </Spin>
    </div>
  )
}

export default ImportMaterial