export interface LoyaltyTopEntry {
  username: string
  points: number
  rank: number
}

export interface PointTransaction {
  id: string
  channelSlug: string
  kickUserId: string | number
  amount: number
  type: string
  reason: string | null
  createdAt: string
}
