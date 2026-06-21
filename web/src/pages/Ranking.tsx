import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Player {
  id: number
  kickUserId: number
  username: string
  wins: number
  losses: number
  draws: number
  points: number
  rank: number
}

export default function Ranking() {
  const { data, isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/players`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data.players as Player[]
    },
  })

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Ranking de Jogadores</h1>

      {!data || data.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          Nenhum jogador cadastrado ainda.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Jogador
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Pontos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Vitórias
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Empates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Derrotas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.map((player) => (
                <tr key={player.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                    {player.rank <= 3 ? (
                      <span className="text-2xl">
                        {player.rank === 1
                          ? '🥇'
                          : player.rank === 2
                          ? '🥈'
                          : '🥉'}
                      </span>
                    ) : (
                      `#${player.rank}`
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {player.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-400 font-bold">
                    {player.points}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">
                    {player.wins}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {player.draws}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400">
                    {player.losses}
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
