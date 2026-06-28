export type PollStatus = 'open' | 'closed'

export interface PollVoteRecord {
  id: string
  pollId: string
  kickUserId: string | number
  username: string
  option: number
  weight: number
  createdAt: string
}

export interface PollResultOption {
  option: number
  text: string
  score: number
  percentage?: number
}

export interface Poll {
  id: string
  channelSlug: string
  question: string
  options: string[]
  status: PollStatus
  durationS: number
  weightedSubs: boolean
  closesAt: string | null
  closedAt: string | null
  winnerOption: number | null
  createdAt: string
  votes?: PollVoteRecord[]
  results?: PollResultOption[]
  totalVotes?: number
}

export interface CreatePollPayload {
  question: string
  options: string[]
  durationS?: number
  weightedSubs?: boolean
}

export interface ClosePollResult {
  ok: boolean
  pollId: string
  question: string
  winnerOption: number | null
  winnerText: string | null
  totalVotes: number
  results: PollResultOption[]
  error?: string
}
