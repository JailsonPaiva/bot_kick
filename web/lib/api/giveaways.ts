import { apiClient } from './client'
import type { Giveaway, CreateGiveawayPayload, DrawGiveawayResult } from '@/types/giveaways'

interface GiveawayRaw extends Omit<Giveaway, 'entryCount' | 'winnerUsername' | 'winnerKickUserId'> {
  entries?: Giveaway['entries']
  winnerKickUserId?: string | number | null
}

function mapGiveaway(raw: GiveawayRaw): Giveaway {
  const winnerEntry = raw.entries?.find(
    (e) => raw.winnerKickUserId != null && String(e.kickUserId) === String(raw.winnerKickUserId)
  )
  return {
    ...raw,
    winnerKickUserId: raw.winnerKickUserId ?? null,
    entryCount: raw.entries?.length ?? 0,
    winnerUsername: winnerEntry?.username ?? null,
  }
}

export async function fetchGiveaways(): Promise<Giveaway[]> {
  const res = await apiClient.get('/api/giveaways')
  const rows = res.data.data as GiveawayRaw[]
  return rows.map(mapGiveaway)
}

export async function createGiveaway(payload: CreateGiveawayPayload): Promise<Giveaway> {
  const res = await apiClient.post('/api/giveaways', {
    prize: payload.prize,
    filterType: payload.filterType ?? 'everyone',
    costPoints: payload.costPoints ?? 0,
  })
  return mapGiveaway(res.data.data as GiveawayRaw)
}

export async function drawGiveaway(): Promise<DrawGiveawayResult> {
  const res = await apiClient.post('/api/giveaways/draw', {})
  return res.data.data as DrawGiveawayResult
}

export async function rerollGiveaway(): Promise<DrawGiveawayResult> {
  const res = await apiClient.post('/api/giveaways/reroll', {})
  return res.data.data as DrawGiveawayResult
}
