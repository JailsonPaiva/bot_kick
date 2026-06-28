export interface Command {
  id: string
  channelSlug: string
  trigger: string
  response: string
  aliases: string[]
  cooldownSeconds: number
  userCooldownSeconds: number
  permissionLevel: string
  enabled: boolean
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateCommandPayload {
  trigger: string
  response: string
  aliases?: string[]
  cooldownSeconds?: number
  userCooldownSeconds?: number
  permissionLevel?: string
}

export type UpdateCommandPayload = Partial<CreateCommandPayload>
