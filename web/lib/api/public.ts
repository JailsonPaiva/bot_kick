const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export interface PublicRankingEntry {
  username: string
  points: number
  rank: number
}

interface PublicRankingRow {
  username: string
  balance?: number
  points?: number
}

export async function fetchPublicRanking(
  channelSlug: string,
  period: 'week' | 'month' | 'all' = 'all',
  limit = 20
): Promise<PublicRankingEntry[]> {
  const url = `${API_URL}/api/public/ranking/${channelSlug}?period=${period}&limit=${limit}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error('Failed to fetch ranking')
  const json = await res.json() as {
    data: { period: string; ranking: PublicRankingRow[] }
  }
  return json.data.ranking.map((row, index) => ({
    username: row.username,
    points: row.points ?? row.balance ?? 0,
    rank: index + 1,
  }))
}
