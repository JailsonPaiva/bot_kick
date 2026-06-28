import { apiClient } from './client'
import type { Poll, CreatePollPayload, ClosePollResult, PollResultOption } from '@/types/polls'

interface PollRaw extends Omit<Poll, 'votes' | 'results' | 'totalVotes'> {
  votes?: Array<{ option: number; weight: number }>
}

function buildPollResults(poll: PollRaw): PollResultOption[] {
  const tally = new Map<number, number>()
  for (const vote of poll.votes ?? []) {
    tally.set(vote.option, (tally.get(vote.option) ?? 0) + vote.weight)
  }
  const total = [...tally.values()].reduce((sum, n) => sum + n, 0)
  return poll.options.map((text, index) => {
    const option = index + 1
    const score = tally.get(option) ?? 0
    return {
      option,
      text,
      score,
      percentage: total > 0 ? Math.round((score / total) * 100) : 0,
    }
  })
}

function mapPoll(raw: PollRaw): Poll {
  const results = buildPollResults(raw)
  const totalVotes = results.reduce((sum, r) => sum + r.score, 0)
  const { votes: _votes, ...rest } = raw
  return { ...rest, results, totalVotes }
}

export async function fetchPolls(): Promise<Poll[]> {
  const res = await apiClient.get('/api/polls')
  const rows = res.data.data as PollRaw[]
  return rows.map(mapPoll)
}

export async function fetchPollById(id: string): Promise<Poll | null> {
  const polls = await fetchPolls()
  return polls.find((p) => p.id === id) ?? null
}

export async function createPoll(payload: CreatePollPayload): Promise<Poll> {
  const res = await apiClient.post('/api/polls', {
    question: payload.question,
    options: payload.options,
    durationS: payload.durationS ?? 60,
    weightedSubs: payload.weightedSubs ?? false,
  })
  return mapPoll(res.data.data as PollRaw)
}

export async function closePoll(): Promise<ClosePollResult> {
  const res = await apiClient.post('/api/polls/end', {})
  return res.data.data as ClosePollResult
}
