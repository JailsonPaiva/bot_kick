export interface Timer {
  id: string
  channelSlug: string
  name: string
  messages: string[]
  intervalSeconds: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTimerPayload {
  name: string
  messages: string[]
  intervalSeconds: number
}

export type UpdateTimerPayload = Partial<CreateTimerPayload>
