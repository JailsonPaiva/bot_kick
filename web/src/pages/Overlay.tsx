import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import { getApiUrl } from '../api/alertsClient'
import type { OverlayAlertEvent } from '../types/alerts'

export default function Overlay() {
  const { token } = useParams()
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

  return (
    <div className="h-screen w-screen bg-transparent text-white overflow-hidden">
      <div className="absolute top-3 left-4 text-[10px] text-white/40 tracking-wide">
        OVERLAY OBS · {status}
      </div>

      <div className="h-full w-full flex items-end justify-center pb-16 px-8 pointer-events-none">
        <div
          className={`w-full max-w-3xl rounded-2xl border border-white/20 bg-black/55 backdrop-blur-md shadow-2xl ${visibilityClass}`}
        >
          {alert ? (
            <div className="p-6 flex items-center gap-5">
              {alert.imageUrl ? (
                <img
                  src={alert.imageUrl}
                  alt={alert.type}
                  className="w-20 h-20 rounded-xl object-cover border border-white/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-4xl">
                  🔔
                </div>
              )}

              <div className="min-w-0">
                <p className="text-cyan-300 text-sm font-semibold uppercase tracking-wider mb-1">
                  {alert.title}
                </p>
                <p className="text-2xl font-bold leading-tight break-words">
                  {alert.message}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-white/50 text-sm">
              Aguardando alertas...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
