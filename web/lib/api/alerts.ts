import { apiClient } from './client'
import type { AlertConfig, OverlayTokenResponse } from '@/types/alerts'

export async function fetchAlertConfigs(): Promise<AlertConfig[]> {
  const res = await apiClient.get('/api/alerts/config')
  return res.data.data as AlertConfig[]
}

export async function updateAlertConfig(
  type: string,
  payload: Partial<Pick<AlertConfig, 'isActive' | 'imageUrl' | 'message' | 'durationMs'>>
): Promise<AlertConfig> {
  const res = await apiClient.put('/api/alerts/config', { type, ...payload })
  return res.data.data as AlertConfig
}

export async function testAlert(type: string): Promise<void> {
  await apiClient.post('/api/alerts/test', { type })
}

export async function fetchOverlayToken(channelSlug?: string): Promise<OverlayTokenResponse> {
  const res = await apiClient.get('/api/alerts/overlay-token', {
    params: channelSlug ? { channel: channelSlug } : undefined,
  })
  return res.data.data as OverlayTokenResponse
}
