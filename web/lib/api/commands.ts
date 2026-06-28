import { apiClient } from './client'
import type { Command, CreateCommandPayload, UpdateCommandPayload } from '@/types/commands'

export async function fetchCommands(): Promise<Command[]> {
  const res = await apiClient.get('/api/commands')
  return res.data.data as Command[]
}

export async function createCommand(payload: CreateCommandPayload): Promise<Command> {
  const res = await apiClient.post('/api/commands', {
    trigger: payload.trigger,
    response: payload.response,
    aliases: payload.aliases,
    permission: payload.permission ?? 'everyone',
    cooldown: payload.cooldown ?? 5,
  })
  return res.data.data as Command
}

export async function updateCommand(id: string, payload: UpdateCommandPayload): Promise<Command> {
  const body: Record<string, unknown> = {}
  if (payload.response !== undefined) body.response = payload.response
  if (payload.aliases !== undefined) body.aliases = payload.aliases
  if (payload.permission !== undefined) body.permission = payload.permission
  if (payload.cooldown !== undefined) body.cooldown = payload.cooldown
  if (payload.isActive !== undefined) body.isActive = payload.isActive

  const res = await apiClient.put(`/api/commands/${id}`, body)
  return res.data.data as Command
}

export async function toggleCommand(id: string): Promise<Command> {
  const res = await apiClient.patch(`/api/commands/${id}/toggle`)
  return res.data.data as Command
}

export async function deleteCommand(id: string): Promise<void> {
  await apiClient.delete(`/api/commands/${id}`)
}
