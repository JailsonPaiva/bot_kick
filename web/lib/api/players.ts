import { apiClient } from './client'

export interface Player {
  id: string
  kickUserId: number
  username: string
  wins: number
  losses: number
  draws: number
  points: number
  rank: number
}

export async function fetchPlayers(): Promise<Player[]> {
  const res = await apiClient.get('/api/players')
  return res.data.data.players as Player[]
}
