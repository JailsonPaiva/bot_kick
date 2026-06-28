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
