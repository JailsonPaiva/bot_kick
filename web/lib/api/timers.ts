import { apiClient } from './client'
import type { Timer, CreateTimerPayload, UpdateTimerPayload } from '@/types/timers'

export async function fetchTimers(): Promise<Timer[]> {
  const res = await apiClient.get('/api/timers')
  return res.data.data as Timer[]
}

export async function createTimer(payload: CreateTimerPayload): Promise<Timer> {
  const res = await apiClient.post('/api/timers', payload)
  return res.data.data as Timer
}

export async function updateTimer(id: string, payload: UpdateTimerPayload): Promise<Timer> {
  const res = await apiClient.put(`/api/timers/${id}`, payload)
  return res.data.data as Timer
}

export async function toggleTimer(id: string, enabled: boolean): Promise<Timer> {
  const res = await apiClient.patch(`/api/timers/${id}/toggle`, { enabled })
  return res.data.data as Timer
}

export async function deleteTimer(id: string): Promise<void> {
  await apiClient.delete(`/api/timers/${id}`)
}
