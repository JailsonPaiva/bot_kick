export type Cell = 'X' | 'O' | null

export interface PlayGameView {
  gameId: string
  channelSlug: string
  status: 'waiting' | 'active' | 'finished'
  playerX: { username: string; kickUserId: number; symbol: 'X' }
  playerO: { username: string; kickUserId: number; symbol: 'O' } | null
  board: Cell[]
  currentTurn: 'X' | 'O'
  yourSymbol: 'X' | 'O' | null
  isYourTurn: boolean
  winner: 'X' | 'O' | null
  winnerUsername: string | null
  finishedReason: 'win' | 'draw' | 'forfeit' | null
  token?: string
}

export interface GameUpdateEvent {
  event: 'start' | 'move' | 'end' | 'waiting'
  game: PlayGameView
  timestamp: number
}
