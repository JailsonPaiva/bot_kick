'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPlayers } from '@/lib/api/players'

export default function RankingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: fetchPlayers,
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Ranking de Jogadores</h1>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : !data || data.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
          Nenhum jogador cadastrado ainda.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                {['Rank', 'Jogador', 'Pontos', 'Vitórias', 'Empates', 'Derrotas'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data.map((player) => (
                <tr key={player.id} className="hover:bg-gray-700/20 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold">
                    {player.rank <= 3 ? (
                      <span className="text-2xl">
                        {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      `#${player.rank}`
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{player.username}</td>
                  <td className="px-6 py-4 text-sm text-yellow-400 font-bold">{player.points}</td>
                  <td className="px-6 py-4 text-sm text-green-400">{player.wins}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{player.draws}</td>
                  <td className="px-6 py-4 text-sm text-red-400">{player.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
