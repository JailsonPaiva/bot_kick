import axios from 'axios'
import type { PlayGameView } from '@/types/play'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function fetchPlaySession(token: string): Promise<PlayGameView> {
  const res = await axios.get(`${API_URL}/api/play/session`, {
    params: { token },
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data.data as PlayGameView
}

export async function submitMove(
  token: string,
  position: number
): Promise<{ game: PlayGameView | null; finished: boolean; message?: string }> {
  const res = await axios.post(
    `${API_URL}/api/play/move`,
    { position },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return res.data.data as { game: PlayGameView | null; finished: boolean; message?: string }
}

export function getApiUrl(): string {
  return API_URL
}
