import { Suspense } from 'react'
import { fetchPublicRanking } from '@/lib/api/public'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ channelSlug: string }>
  searchParams: Promise<{ period?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { channelSlug } = await params
  return {
    title: `Ranking — ${channelSlug} | Kick Bot`,
    description: `Top viewers por pontos de fidelidade no canal ${channelSlug}`,
  }
}

async function RankingTable({
  channelSlug,
  period,
}: {
  channelSlug: string
  period: 'week' | 'month' | 'all'
}) {
  let ranking: Awaited<ReturnType<typeof fetchPublicRanking>> = []
  let error = false

  try {
    ranking = await fetchPublicRanking(channelSlug, period, 20)
  } catch {
    error = true
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-xl p-8 text-center text-red-300">
        Não foi possível carregar o ranking. Verifique o canal e tente novamente.
      </div>
    )
  }

  if (ranking.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
        Nenhum dado de pontos disponível para este período.
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-700/50">
          <tr>
            {['#', 'Usuário', 'Pontos'].map((h) => (
              <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {ranking.map((entry) => (
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
              <td className="px-6 py-4 text-sm font-medium text-cyan-300">{entry.username}</td>
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
  )
}

export default async function PublicRankingPage({ params, searchParams }: PageProps) {
  const { channelSlug } = await params
  const { period } = await searchParams
  const validPeriod = (['week', 'month', 'all'] as const).includes(period as 'week' | 'month' | 'all')
    ? (period as 'week' | 'month' | 'all')
    : 'all'

  const periodLabel = { week: 'Esta Semana', month: 'Este Mês', all: 'Geral' }

  return (
    <div className="min-h-screen bg-gray-900 text-white py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-3xl font-bold">Ranking de Pontos</h1>
          <p className="text-gray-400 mt-1">Canal: <span className="text-cyan-300 font-medium">{channelSlug}</span></p>
        </header>

        <nav className="flex justify-center gap-2 mb-8">
          {(['week', 'month', 'all'] as const).map((p) => (
            <a
              key={p}
              href={`/ranking/${channelSlug}?period=${p}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                validPeriod === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {periodLabel[p]}
            </a>
          ))}
        </nav>

        <Suspense fallback={
          <div className="text-center py-8 text-gray-400">Carregando ranking...</div>
        }>
          <RankingTable channelSlug={channelSlug} period={validPeriod} />
        </Suspense>

        <footer className="text-center mt-8 text-xs text-gray-500">
          Atualizado a cada 5 minutos · Kick Bot Dashboard
        </footer>
      </div>
    </div>
  )
}
