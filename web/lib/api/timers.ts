import { apiClient } from './client'
import type { Timer, CreateTimerPayload, UpdateTimerPayload } from '@/types/timers'

export async function fetchTimers(): Promise<Timer[]> {
  const res = await apiClient.get('/api/timers')
  return res.data.data as Timer[]
}

export async function createTimer(payload: CreateTimerPayload): Promise<Timer> {
  const res = await apiClient.post('/api/timers', {
    name: payload.name,
    messages: payload.messages,
    intervalMinutes: payload.intervalMinutes,
    minViewers: payload.minViewers ?? 0,
  })
  return res.data.data as Timer
}

export async function updateTimer(id: string, payload: UpdateTimerPayload): Promise<Timer> {
  const body: Record<string, unknown> = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.messages !== undefined) body.messages = payload.messages
  if (payload.intervalMinutes !== undefined) body.intervalMinutes = payload.intervalMinutes
  if (payload.minViewers !== undefined) body.minViewers = payload.minViewers
  if (payload.isActive !== undefined) body.isActive = payload.isActive

  const res = await apiClient.put(`/api/timers/${id}`, body)
  return res.data.data as Timer
}

export async function toggleTimer(id: string): Promise<Timer> {
  const res = await apiClient.patch(`/api/timers/${id}/toggle`)
  return res.data.data as Timer
}

export async function deleteTimer(id: string): Promise<void> {
  await apiClient.delete(`/api/timers/${id}`)
}
