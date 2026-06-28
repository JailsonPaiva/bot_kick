export interface ModerationConfig {
  id: string
  channelSlug: string
  blockLinks: boolean
  linkWhitelist: string[]
  blockCaps: boolean
  capsThreshold: number
  blockSpam: boolean
  spamWindowSeconds: number
  spamMaxMessages: number
  bannedWords: string[]
  warnMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface ModerationLog {
  id: string
  channelSlug: string
  username: string
  kickUserId: number | null
  reason: string
  message: string
  action: string
  createdAt: string
}

export type UpdateModerationPayload = Partial<Omit<ModerationConfig, 'id' | 'channelSlug' | 'createdAt' | 'updatedAt'>>
