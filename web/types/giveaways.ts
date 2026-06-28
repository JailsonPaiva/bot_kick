export type GiveawayStatus = 'open' | 'closed'
export type GiveawayFilterType = 'everyone' | 'subscribers' | 'followers' | 'both'

export interface GiveawayEntry {
  id: string
  giveawayId: string
  username: string
  kickUserId: string | number
  slug: string
  createdAt: string
}

export interface Giveaway {
  id: string
  channelSlug: string
  prize: string
  status: GiveawayStatus
  filterType: GiveawayFilterType
  costPoints: number
  winnerKickUserId: string | number | null
  winnerUsername?: string | null
  entryCount?: number
  entries?: GiveawayEntry[]
  createdAt: string
  closedAt: string | null
}

export interface CreateGiveawayPayload {
  prize: string
  filterType?: GiveawayFilterType
  costPoints?: number
}

export interface DrawGiveawayResult {
  ok: boolean
  winner: { kickUserId: number; username: string } | null
  giveawayId: string
  entries: number
  prize: string
  error?: string
}
