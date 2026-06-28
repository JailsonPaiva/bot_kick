'use client'

import { useEffect, useMemo, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { getApiUrl } from '@/lib/api/client'
import type { OverlayAlertEvent } from '@/types/alerts'

export function useAlertsSocket(token: string | null | undefined) {
  const [alert, setAlert] = useState<OverlayAlertEvent | null>(null)
  const [status, setStatus] = useState('Conectando...')
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('Token de overlay ausente.')
      return
    }

    const socket: Socket = io(getApiUrl(), {
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      setStatus('Conectado')
      socket.emit('join:alerts', { token })
    })

    socket.on('disconnect', () => {
      setStatus('Desconectado')
    })

    socket.on('alert:event', (payload: OverlayAlertEvent) => {
      setAlert(payload)
      setPulse(true)

      const duration = Math.max(payload.durationMs ?? 5000, 1200)
      const hideTimer = window.setTimeout(() => {
        setPulse(false)
      }, duration - 350)
      const clearTimer = window.setTimeout(() => {
        setAlert((current) =>
          current?.timestamp === payload.timestamp ? null : current
        )
      }, duration)

      return () => {
        window.clearTimeout(hideTimer)
        window.clearTimeout(clearTimer)
      }
    })

    socket.on('connect_error', () => {
      setStatus('Erro de conexão')
    })

    return () => {
      socket.disconnect()
    }
  }, [token])

  const visibilityClass = useMemo(
    () =>
      alert ? (pulse ? 'overlay-alert-enter' : 'overlay-alert-exit') : 'opacity-0',
    [alert, pulse]
  )

  return { alert, status, pulse, visibilityClass }
}
