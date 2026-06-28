import { apiClient } from './client'
import type { AlertConfig, OverlayTokenResponse } from '@/types/alerts'

export async function fetchAlertConfigs(): Promise<AlertConfig[]> {
  const res = await apiClient.get('/api/alerts/config')
  return res.data.data as AlertConfig[]
}

export async function updateAlertConfig(
  alertType: string,
  payload: Partial<Pick<AlertConfig, 'enabled' | 'imageUrl' | 'message' | 'durationMs'>>
): Promise<AlertConfig> {
  const res = await apiClient.put('/api/alerts/config', { alertType, ...payload })
  return res.data.data as AlertConfig
}

export async function testAlert(alertType: string): Promise<void> {
  await apiClient.post('/api/alerts/test', { alertType })
}

export async function fetchOverlayToken(channelSlug?: string): Promise<OverlayTokenResponse> {
  const res = await apiClient.get('/api/alerts/overlay-token', {
    params: channelSlug ? { channel: channelSlug } : undefined,
  })
  return res.data.data as OverlayTokenResponse
}
