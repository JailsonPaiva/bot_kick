export interface Command {
  id: string
  channelSlug: string
  trigger: string
  response: string
  aliases: string[]
  permission: string
  cooldown: number
  isActive: boolean
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateCommandPayload {
  trigger: string
  response: string
  aliases?: string[]
  permission?: string
  cooldown?: number
}

export type UpdateCommandPayload = Partial<
  CreateCommandPayload & { isActive: boolean }
>
