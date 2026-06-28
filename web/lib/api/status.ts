import { apiClient } from './client'

export interface BotStatus {
  online: boolean
  uptime: number
  activeGames: number
  totalPlayers: number
  version: string
}

export async function fetchStatus(): Promise<BotStatus> {
  const res = await apiClient.get('/api/status')
  return res.data.data as BotStatus
}
