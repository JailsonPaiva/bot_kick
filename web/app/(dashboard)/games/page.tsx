'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchGames } from '@/lib/api/games'
import { Badge } from '@/components/ui/Badge'

export default function GamesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: fetchGames,
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Histórico de Jogos</h1>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : !data || data.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
          Nenhuma partida registrada ainda.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                {['Tipo', 'Jogador X', 'Jogador O', 'Vencedor', 'Status', 'Data'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data.map((game) => (
                <tr key={game.id} className="hover:bg-gray-700/20 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono">{game.gameType.toUpperCase()}</td>
                  <td className="px-6 py-4 text-sm">{game.playerXUsername}</td>
                  <td className="px-6 py-4 text-sm">{game.playerOUsername}</td>
                  <td className="px-6 py-4 text-sm">{game.winnerUsername ?? 'Empate'}</td>
                  <td className="px-6 py-4 text-sm">
                    <Badge
                      variant={
                        game.status === 'finished' ? 'green' : game.status === 'active' ? 'blue' : 'gray'
                      }
                    >
                      {game.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
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
