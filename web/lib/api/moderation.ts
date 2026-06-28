import { apiClient } from './client'
import type { ModerationConfig, ModerationLog, UpdateModerationPayload } from '@/types/moderation'

export async function fetchModerationConfig(): Promise<ModerationConfig> {
  const res = await apiClient.get('/api/moderation')
  return res.data.data as ModerationConfig
}

export async function updateModerationConfig(payload: UpdateModerationPayload): Promise<ModerationConfig> {
  const res = await apiClient.put('/api/moderation', payload)
  return res.data.data as ModerationConfig
}

export async function fetchModerationLogs(params?: {
  page?: number
  limit?: number
  username?: string
}): Promise<{ logs: ModerationLog[]; total: number }> {
  const res = await apiClient.get('/api/moderation/logs', { params })
  return res.data.data as { logs: ModerationLog[]; total: number }
}
