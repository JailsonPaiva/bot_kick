import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface BotStatus {
  online: boolean
  uptime: number
  activeGames: number
  totalPlayers: number
  version: string
}

export default function Dashboard() {
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
    </div>
  )
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
