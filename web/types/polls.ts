export type PollStatus = 'open' | 'closed'

export interface PollOption {
  index: number
  text: string
  votes: number
  percentage?: number
}

export interface Poll {
  id: string
  channelSlug: string
  question: string
  options: string[]
  status: PollStatus
  durationSeconds: number | null
  allowSubWeight: boolean
  subWeight: number
  endsAt: string | null
  createdAt: string
  updatedAt: string
  votes?: PollOption[]
  totalVotes?: number
}

export interface CreatePollPayload {
  question: string
  options: string[]
  durationSeconds?: number
  allowSubWeight?: boolean
  subWeight?: number
}
