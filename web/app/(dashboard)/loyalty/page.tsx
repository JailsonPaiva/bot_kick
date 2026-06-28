'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLoyaltyTop, fetchLoyaltyTransactions } from '@/lib/api/loyalty'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type Tab = 'ranking' | 'transactions'

export default function LoyaltyPage() {
  const [tab, setTab] = useState<Tab>('ranking')
  const [txPage, setTxPage] = useState(1)
  const TX_LIMIT = 20

  const { data: top = [], isLoading: topLoading } = useQuery({
    queryKey: ['loyalty-top'],
    queryFn: () => fetchLoyaltyTop(50),
    enabled: tab === 'ranking',
  })

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['loyalty-transactions', txPage],
    queryFn: () => fetchLoyaltyTransactions({ page: txPage, limit: TX_LIMIT }),
    enabled: tab === 'transactions',
  })

  const txTypeColor = (type: string) => {
    if (type === 'earn') return 'green'
    if (type === 'spend') return 'red'
    if (type === 'transfer_in') return 'blue'
    if (type === 'transfer_out') return 'yellow'
    return 'gray'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Pontos de Fidelidade</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('ranking')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'ranking' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Ranking
          </button>
          <button
            onClick={() => setTab('transactions')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'transactions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Transações
          </button>
        </div>
      </div>

      {tab === 'ranking' && (
        <>
          {topLoading ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : top.length === 0 ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
              Nenhum dado de pontos ainda. Os pontos são acumulados com atividade no chat.
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    {['Posição', 'Usuário', 'Pontos'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {top.map((entry) => (
                    <tr key={entry.username} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold">
                        {entry.rank <= 3 ? (
                          <span className="text-2xl">
                            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          `#${entry.rank}`
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-cyan-300">
                        {entry.username}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-yellow-400 font-bold text-lg">
                          {entry.points.toLocaleString()}
                        </span>
                        <span className="text-gray-500 text-xs ml-1">pts</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'transactions' && (
        <>
          {txLoading ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : !txData || txData.transactions.length === 0 ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
              Nenhuma transação registrada.
            </div>
          ) : (
            <>
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-4">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      {['Usuário', 'Tipo', 'Pontos', 'Descrição', 'Data'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {txData.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-700/20">
                        <td className="px-4 py-3 text-sm text-cyan-300 font-medium">{tx.username}</td>
                        <td className="px-4 py-3">
                          <Badge variant={txTypeColor(tx.type) as 'green' | 'red' | 'blue' | 'yellow' | 'gray'}>
                            {tx.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold">
                          <span className={tx.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                          {tx.description ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {new Date(tx.createdAt).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => p - 1)}
                >
                  ← Anterior
                </Button>
                <span className="text-sm text-gray-400 self-center">Página {txPage}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={txData.transactions.length < TX_LIMIT}
                  onClick={() => setTxPage((p) => p + 1)}
                >
                  Próxima →
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
