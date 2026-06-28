'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchStatus } from '@/lib/api/status'
import { fetchOverlayToken } from '@/lib/api/alerts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function DashboardPage() {
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)
  const [overlayLoading, setOverlayLoading] = useState(false)
  const [overlayError, setOverlayError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 5000,
  })

  const uptimeMinutes = data ? Math.floor(data.uptime / 60000) : 0

  async function handleGenerateOverlay() {
    setOverlayLoading(true)
    setOverlayError(null)
    try {
      const result = await fetchOverlayToken()
      setOverlayUrl(result.overlayUrl)
    } catch {
      setOverlayError('Não foi possível gerar token do overlay.')
    } finally {
      setOverlayLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Status"
              value={data?.online ? 'Online' : 'Offline'}
              badge={<Badge variant={data?.online ? 'green' : 'red'}>{data?.online ? 'Online' : 'Offline'}</Badge>}
            />
            <StatCard title="Uptime" value={`${uptimeMinutes} min`} color="blue" />
            <StatCard title="Partidas Ativas" value={data?.activeGames ?? 0} color="purple" />
            <StatCard title="Total Jogadores" value={data?.totalPlayers ?? 0} color="yellow" />
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-semibold mb-3">Informações</h2>
            <p className="text-gray-400 text-sm">
              Versão: <span className="text-white font-medium">{data?.version}</span>
            </p>
            <p className="text-gray-400 text-sm mt-1">
              O bot está monitorando o chat e respondendo a comandos em tempo real.
            </p>
          </div>
        </>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-2">Overlay para OBS</h2>
        <p className="text-gray-400 text-sm mb-4">
          Gere um link de overlay com token para usar no Browser Source do OBS.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => void handleGenerateOverlay()}
            loading={overlayLoading}
            variant="primary"
            size="sm"
          >
            Gerar link de overlay
          </Button>
          {overlayUrl && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(overlayUrl)}
            >
              Copiar link
            </Button>
          )}
        </div>

        {overlayError && <p className="text-red-400 text-sm mt-3">{overlayError}</p>}
        {overlayUrl && (
          <div className="mt-4 p-3 bg-black/40 border border-gray-700 rounded text-xs break-all text-cyan-200">
            {overlayUrl}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  color,
  badge,
}: {
  title: string
  value: string | number
  color?: string
  badge?: React.ReactNode
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-900/40 border-blue-700',
    purple: 'bg-purple-900/40 border-purple-700',
    yellow: 'bg-yellow-900/40 border-yellow-700',
  }

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color ?? ''] ?? 'bg-gray-800 border-gray-700'}`}>
      <h3 className="text-sm font-medium text-gray-400 mb-2">{title}</h3>
      {badge ?? <p className="text-3xl font-bold">{value}</p>}
    </div>
  )
}
