export interface ViewerPoints {
  id: string
  channelSlug: string
  username: string
  kickUserId: number | null
  points: number
  totalEarned: number
  rank?: number
}

export interface PointTransaction {
  id: string
  channelSlug: string
  username: string
  amount: number
  type: string
  description: string | null
  createdAt: string
}

export interface LoyaltyTopEntry {
  username: string
  points: number
  rank: number
}
