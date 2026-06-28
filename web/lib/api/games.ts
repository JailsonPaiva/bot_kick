import { apiClient } from './client'

export interface Game {
  id: string
  gameType: string
  channelSlug: string
  playerXUsername: string
  playerOUsername: string
  winnerUsername: string | null
  status: string
  startedAt: string
  finishedAt: string | null
}

export async function fetchGames(): Promise<Game[]> {
  const res = await apiClient.get('/api/games')
  return res.data.data as Game[]
}
