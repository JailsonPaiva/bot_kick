import { apiClient } from './client'
import type { LoyaltyTopEntry, PointTransaction } from '@/types/loyalty'

interface ViewerPointsRaw {
  username: string
  balance: number
}

export async function fetchLoyaltyTop(limit = 20): Promise<LoyaltyTopEntry[]> {
  const res = await apiClient.get('/api/loyalty/top', { params: { limit } })
  const rows = res.data.data as ViewerPointsRaw[]
  return rows.map((row, index) => ({
    username: row.username,
    points: row.balance,
    rank: index + 1,
  }))
}

export async function fetchLoyaltyTransactions(params?: {
  page?: number
  limit?: number
}): Promise<{ transactions: PointTransaction[]; total: number }> {
  const res = await apiClient.get('/api/loyalty/transactions', { params })
  const data = res.data.data as { transactions: PointTransaction[]; total: number }
  return {
    transactions: data.transactions,
    total: data.total,
  }
}
