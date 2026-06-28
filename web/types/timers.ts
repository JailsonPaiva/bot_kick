export interface Timer {
  id: string
  channelSlug: string
  name: string
  messages: string[]
  intervalMinutes: number
  minViewers: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTimerPayload {
  name: string
  messages: string[]
  intervalMinutes: number
  minViewers?: number
}

export type UpdateTimerPayload = Partial<CreateTimerPayload & { isActive: boolean }>
