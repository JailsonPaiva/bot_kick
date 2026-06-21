import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Game {
  id: string
  gameType: string
  channelSlug: string
  playerXUsername: string
  playerOUsername: string
  winnerUsername: string | null
  status: string
  startedAt: string
  finishedAt: string | null
}

export default function Games() {
  const { data, isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/games`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data as Game[]
    },
  })

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Histórico de Jogos</h1>

      {!data || data.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          Nenhuma partida registrada ainda.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Jogador X
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Jogador O
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Vencedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Data
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.map((game) => (
                <tr key={game.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {game.gameType.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {game.playerXUsername}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {game.playerOUsername}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {game.winnerUsername || 'Empate'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        game.status === 'finished'
                          ? 'bg-green-900 text-green-200'
                          : game.status === 'active'
                          ? 'bg-blue-900 text-blue-200'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {game.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(game.startedAt).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
