import axios from 'axios'
import type { OverlayTokenResponse } from '../types/alerts'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function fetchOverlayToken(
  channelSlug?: string
): Promise<OverlayTokenResponse> {
  const token = localStorage.getItem('token')
  const response = await axios.get(`${API_URL}/api/alerts/overlay-token`, {
    params: channelSlug ? { channel: channelSlug } : undefined,
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data.data as OverlayTokenResponse
}

export function getApiUrl(): string {
  return API_URL
}
