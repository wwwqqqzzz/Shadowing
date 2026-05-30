import axios from 'axios'

const BASE = 'http://localhost:3000/api'

export interface Material {
  id: string
  title: string
  source: string
  level: 'beginner' | 'intermediate' | 'advanced'
  sentenceCount: number
  durationMs: number
  status: 'draft' | 'published'
  createdAt: string
}

export interface ImportResult {
  materialId: string
  sentenceCount: number
  durationMs: number
  preview: Array<{ order: number; startTime: number; text: string }>
}

export const getMaterials = (params?: { status?: string }) =>
  axios.get<Material[]>(`${BASE}/materials`, { params })

export const importMaterial = (formData: FormData) =>
  axios.post<ImportResult>(`${BASE}/admin/materials/import`, formData)

export const updateStatus = (id: string, status: string) =>
  axios.put(`${BASE}/admin/materials/${id}/status`, { status })

export const deleteMaterial = (id: string) =>
  axios.delete(`${BASE}/admin/materials/${id}`)

export interface Sentence {
  id: string
  order: number
  startTime: number
  endTime: number
  text: string
  translation?: string | null
  audioUrl?: string | null
}

export const getSentences = (materialId: string) =>
  axios.get<Sentence[]>(`${BASE}/materials/${materialId}/sentences`)

export const updateSentence = (id: string, data: Partial<Pick<Sentence, 'startTime' | 'endTime' | 'text' | 'order' | 'audioUrl'>>) =>
  axios.patch<Sentence>(`${BASE}/admin/materials/sentences/${id}`, data)