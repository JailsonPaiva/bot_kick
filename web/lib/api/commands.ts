import { apiClient } from './client'
import type { Command, CreateCommandPayload, UpdateCommandPayload } from '@/types/commands'

export async function fetchCommands(): Promise<Command[]> {
  const res = await apiClient.get('/api/commands')
  return res.data.data as Command[]
}

export async function createCommand(payload: CreateCommandPayload): Promise<Command> {
  const res = await apiClient.post('/api/commands', payload)
  return res.data.data as Command
}

export async function updateCommand(id: string, payload: UpdateCommandPayload): Promise<Command> {
  const res = await apiClient.put(`/api/commands/${id}`, payload)
  return res.data.data as Command
}

export async function toggleCommand(id: string, enabled: boolean): Promise<Command> {
  const res = await apiClient.patch(`/api/commands/${id}/toggle`, { enabled })
  return res.data.data as Command
}

export async function deleteCommand(id: string): Promise<void> {
  await apiClient.delete(`/api/commands/${id}`)
}
