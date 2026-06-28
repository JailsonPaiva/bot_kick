import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import { fetchOverlayToken } from '../api/alertsClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface BotStatus {
  online: boolean
  uptime: number
  activeGames: number
  totalPlayers: number
  version: string
}

export default function Dashboard() {
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)
  const [overlayLoading, setOverlayLoading] = useState(false)
  const [overlayError, setOverlayError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['status'],
    queryFn: async () => {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data as BotStatus
    },
    refetchInterval: 5000,
  })

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  const uptimeMinutes = data ? Math.floor(data.uptime / 60000) : 0

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Status"
          value={data?.online ? 'Online' : 'Offline'}
          color={data?.online ? 'green' : 'red'}
        />
        <StatCard
          title="Uptime"
          value={`${uptimeMinutes} min`}
          color="blue"
        />
        <StatCard
          title="Partidas Ativas"
          value={data?.activeGames || 0}
          color="purple"
        />
        <StatCard
          title="Total Jogadores"
          value={data?.totalPlayers || 0}
          color="yellow"
        />
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Informações</h2>
        <div className="space-y-2 text-gray-300">
          <p>Versão: {data?.version}</p>
          <p>
            O bot está monitorando o chat e respondendo a comandos em tempo
            real.
          </p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Overlay para OBS (Fase 3)</h2>
        <p className="text-gray-300 mb-4 text-sm">
          Gere um link de overlay com token para usar no Browser Source do OBS.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void handleGenerateOverlay()}
            disabled={overlayLoading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 rounded-md text-sm font-medium"
          >
            {overlayLoading ? 'Gerando...' : 'Gerar link de overlay'}
          </button>
          {overlayUrl && (
            <button
              onClick={() => void navigator.clipboard.writeText(overlayUrl)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-medium"
            >
              Copiar link
            </button>
          )}
        </div>

        {overlayError && (
          <p className="text-red-400 text-sm mt-3">{overlayError}</p>
        )}

        {overlayUrl && (
          <div className="mt-4 p-3 bg-black/40 border border-gray-700 rounded text-xs break-all text-cyan-200">
            {overlayUrl}
          </div>
        )}
      </div>
    </div>
  )

  async function handleGenerateOverlay() {
    setOverlayLoading(true)
    setOverlayError(null)
    try {
      const data = await fetchOverlayToken()
      setOverlayUrl(data.overlayUrl)
    } catch {
      setOverlayError('Não foi possível gerar token do overlay.')
    } finally {
      setOverlayLoading(false)
    }
  }
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string
  value: string | number
  color: string
}) {
  const colorClasses = {
    green: 'bg-green-900 border-green-700',
    red: 'bg-red-900 border-red-700',
    blue: 'bg-blue-900 border-blue-700',
    purple: 'bg-purple-900 border-purple-700',
    yellow: 'bg-yellow-900 border-yellow-700',
  }[color]

  return (
    <div className={`rounded-lg border p-6 ${colorClasses}`}>
      <h3 className="text-sm font-medium text-gray-300 mb-2">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}
