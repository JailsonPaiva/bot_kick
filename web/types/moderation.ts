export interface ModerationConfig {
  id?: string
  channelSlug: string
  linksEnabled: boolean
  linksWhitelist: string[]
  capsEnabled: boolean
  capsPercent: number
  spamEnabled: boolean
  spamWindow: number
  bannedWords: string[]
  actionType: string
  createdAt?: string
  updatedAt?: string
}

export interface ModerationLog {
  id: string
  channelSlug: string
  userId: number
  username: string
  messageId: string
  content: string
  reason: string
  action: string
  createdAt: string
}

export type UpdateModerationPayload = Partial<
  Omit<ModerationConfig, 'id' | 'channelSlug' | 'createdAt' | 'updatedAt'>
>
