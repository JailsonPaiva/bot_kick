export type GiveawayStatus = 'pending' | 'open' | 'closed' | 'finished'
export type GiveawayFilter = 'all' | 'subs' | 'followers'

export interface Giveaway {
  id: string
  channelSlug: string
  prize: string
  status: GiveawayStatus
  filter: GiveawayFilter
  pointsCost: number
  winnerUsername: string | null
  entryCount?: number
  createdAt: string
  updatedAt: string
}

export interface GiveawayEntry {
  id: string
  giveawayId: string
  username: string
  kickUserId: number | null
  createdAt: string
}

export interface CreateGiveawayPayload {
  prize: string
  filter?: GiveawayFilter
  pointsCost?: number
}
