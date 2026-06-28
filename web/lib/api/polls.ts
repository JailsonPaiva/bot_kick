import { apiClient } from './client'
import type { Poll, CreatePollPayload } from '@/types/polls'

export async function fetchPolls(): Promise<Poll[]> {
  const res = await apiClient.get('/api/polls')
  return res.data.data as Poll[]
}

export async function createPoll(payload: CreatePollPayload): Promise<Poll> {
  const res = await apiClient.post('/api/polls', payload)
  return res.data.data as Poll
}

export async function fetchPollStatus(id: string): Promise<Poll> {
  const res = await apiClient.get(`/api/polls/${id}/status`)
  return res.data.data as Poll
}

export async function closePoll(id: string): Promise<Poll> {
  const res = await apiClient.patch(`/api/polls/${id}/close`)
  return res.data.data as Poll
}

export async function deletePoll(id: string): Promise<void> {
  await apiClient.delete(`/api/polls/${id}`)
}
