import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { fetchPlaySession, getApiUrl, submitMove } from '../api/playClient'
import type { GameUpdateEvent, PlayGameView } from '../types/play'

export function usePlaySession(token: string | null) {
  const [game, setGame] = useState<PlayGameView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const movingRef = useRef(false)
  const [lastEvent, setLastEvent] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    if (!token) {
      setError('Link inválido: token ausente.')
      setLoading(false)
      return
    }

    try {
      setError(null)
      const data = await fetchPlaySession(token)
      setGame(data)
    } catch {
      setError('Sessão expirada ou partida encerrada. Use !ttt web no chat novamente.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    if (!token) return

    const socket: Socket = io(getApiUrl(), {
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      socket.emit('join:game', { token })
    })

    socket.on('game:update', (payload: GameUpdateEvent) => {
      setGame(payload.game)
      setLastEvent(payload.event)
      movingRef.current = false
      setMoving(false)
    })

    socket.on('game:error', (payload: { error: string }) => {
      setError(payload.error)
    })

    return () => {
      socket.disconnect()
    }
  }, [token])

  const makeMove = useCallback(
    async (position: number) => {
      if (!token || movingRef.current) return

      movingRef.current = true
      setMoving(true)
      setError(null)

      try {
        const result = await submitMove(token, position)
        if (result.game) {
          setGame(result.game)
        } else if (result.finished) {
          setGame(null)
          setError('Partida encerrada.')
        }
      } catch (err) {
        const message =
          axiosErrorMessage(err) ?? 'Não foi possível realizar a jogada.'
        setError(message)
      } finally {
        movingRef.current = false
        setMoving(false)
      }
    },
    [token]
  )

  return { game, loading, error, moving, lastEvent, makeMove, reload: loadSession }
}

function axiosErrorMessage(err: unknown): string | null {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { error?: string } } }).response?.data
      ?.error === 'string'
  ) {
    return (err as { response: { data: { error: string } } }).response.data.error
  }
  return null
}
