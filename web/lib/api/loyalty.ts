import { apiClient } from './client'
import type { LoyaltyTopEntry, PointTransaction } from '@/types/loyalty'

export async function fetchLoyaltyTop(limit = 20): Promise<LoyaltyTopEntry[]> {
  const res = await apiClient.get('/api/loyalty/top', { params: { limit } })
  return res.data.data as LoyaltyTopEntry[]
}

export async function fetchLoyaltyTransactions(params?: {
  page?: number
  limit?: number
  username?: string
}): Promise<{ transactions: PointTransaction[]; total: number }> {
  const res = await apiClient.get('/api/loyalty/transactions', { params })
  return res.data.data as { transactions: PointTransaction[]; total: number }
}
