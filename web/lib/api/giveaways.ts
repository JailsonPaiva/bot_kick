import { apiClient } from './client'
import type { Giveaway, CreateGiveawayPayload } from '@/types/giveaways'

export async function fetchGiveaways(): Promise<Giveaway[]> {
  const res = await apiClient.get('/api/giveaways')
  return res.data.data as Giveaway[]
}

export async function createGiveaway(payload: CreateGiveawayPayload): Promise<Giveaway> {
  const res = await apiClient.post('/api/giveaways', payload)
  return res.data.data as Giveaway
}

export async function openGiveaway(id: string): Promise<Giveaway> {
  const res = await apiClient.patch(`/api/giveaways/${id}/open`)
  return res.data.data as Giveaway
}

export async function closeGiveaway(id: string): Promise<Giveaway> {
  const res = await apiClient.patch(`/api/giveaways/${id}/close`)
  return res.data.data as Giveaway
}

export async function drawGiveaway(id: string): Promise<{ winner: string; giveaway: Giveaway }> {
  const res = await apiClient.post(`/api/giveaways/${id}/draw`)
  return res.data.data as { winner: string; giveaway: Giveaway }
}

export async function rerollGiveaway(id: string): Promise<{ winner: string; giveaway: Giveaway }> {
  const res = await apiClient.post(`/api/giveaways/${id}/reroll`)
  return res.data.data as { winner: string; giveaway: Giveaway }
}

export async function deleteGiveaway(id: string): Promise<void> {
  await apiClient.delete(`/api/giveaways/${id}`)
}
