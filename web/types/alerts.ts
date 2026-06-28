export interface OverlayAlertEvent {
  type: string
  channelSlug: string
  title: string
  message: string
  imageUrl?: string | null
  durationMs?: number
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface OverlayTokenResponse {
  token: string
  overlayUrl: string
  channelSlug: string
}

export interface AlertConfig {
  id: string
  channelSlug: string
  alertType: string
  enabled: boolean
  imageUrl: string | null
  message: string | null
  durationMs: number
  createdAt: string
  updatedAt: string
}
