'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchGiveaways,
  createGiveaway,
  drawGiveaway,
  rerollGiveaway,
} from '@/lib/api/giveaways'
import type { CreateGiveawayPayload, GiveawayFilterType } from '@/types/giveaways'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'

const FILTER_LABELS: Record<GiveawayFilterType, string> = {
  everyone: 'Todos',
  subscribers: 'Assinantes',
  followers: 'Seguidores',
  both: 'Assinantes + Seguidores',
}

const STATUS_COLORS = {
  open: 'green',
  closed: 'yellow',
} as const

const emptyForm: CreateGiveawayPayload = {
  prize: '',
  filterType: 'everyone',
  costPoints: 0,
}

export default function GiveawaysPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CreateGiveawayPayload>(emptyForm)
  const [winnerMsg, setWinnerMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data: giveaways = [], isLoading } = useQuery({
    queryKey: ['giveaways'],
    queryFn: fetchGiveaways,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['giveaways'] })
  }

  const createMut = useMutation({
    mutationFn: createGiveaway,
    onSuccess: () => {
      invalidate()
      setModalOpen(false)
      setErrorMsg(null)
    },
    onError: () => setErrorMsg('Não foi possível criar o sorteio.'),
  })

  const drawMut = useMutation({
    mutationFn: drawGiveaway,
    onSuccess: (data) => {
      invalidate()
      setErrorMsg(null)
      if (data.winner) {
        setWinnerMsg(`🏆 Vencedor: ${data.winner.username}`)
      } else {
        setWinnerMsg('Sorteio encerrado sem participantes.')
      }
    },
    onError: () => setErrorMsg('Não foi possível sortear.'),
  })

  const rerollMut = useMutation({
    mutationFn: rerollGiveaway,
    onSuccess: (data) => {
      invalidate()
      setErrorMsg(null)
      if (data.winner) {
        setWinnerMsg(`🎲 Novo vencedor: ${data.winner.username}`)
      }
    },
    onError: () => setErrorMsg('Não foi possível fazer reroll.'),
  })

  const activeGiveaway = giveaways.find((g) => g.status === 'open')

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Sorteios</h1>
        <Button onClick={() => setModalOpen(true)} disabled={!!activeGiveaway}>
          + Novo Sorteio
        </Button>
      </div>

      {winnerMsg && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 mb-6 text-center text-yellow-200 text-lg font-semibold">
          {winnerMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-900/30 border border-red-600 rounded-xl p-4 mb-6 text-center text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

      {activeGiveaway && (
        <div className="bg-gray-800 rounded-xl border border-green-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Badge variant={STATUS_COLORS.open}>ABERTO</Badge>
              <h2 className="text-xl font-bold mt-2">{activeGiveaway.prize}</h2>
              <p className="text-sm text-gray-400">
                Filtro: {FILTER_LABELS[activeGiveaway.filterType]} ·{' '}
                Custo: {activeGiveaway.costPoints > 0 ? `${activeGiveaway.costPoints} pts` : 'Grátis'} ·{' '}
                {activeGiveaway.entryCount ?? 0} participantes
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              loading={drawMut.isPending}
              onClick={() => void drawMut.mutateAsync()}
            >
              Sortear vencedor
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : giveaways.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
          Nenhum sorteio criado ainda.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                {['Prêmio', 'Status', 'Filtro', 'Custo', 'Vencedor', 'Participantes', 'Data', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {giveaways.map((g) => (
                <tr key={g.id} className="hover:bg-gray-700/20">
                  <td className="px-4 py-3 text-sm font-medium">{g.prize}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_COLORS[g.status]}>{g.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{FILTER_LABELS[g.filterType]}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {g.costPoints > 0 ? `${g.costPoints} pts` : 'Grátis'}
                  </td>
                  <td className="px-4 py-3 text-sm text-yellow-400 font-medium">
                    {g.winnerUsername ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{g.entryCount ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(g.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    {g.status === 'closed' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={rerollMut.isPending}
                        onClick={() => void rerollMut.mutateAsync()}
                      >
                        Reroll
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title="Novo Sorteio"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              loading={createMut.isPending}
              onClick={() => void createMut.mutateAsync(form)}
            >
              Criar e abrir
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Prêmio"
            placeholder="Ex: Skin exclusiva, 100 pontos..."
            value={form.prize}
            onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Filtro de participantes</label>
            <select
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.filterType}
              onChange={(e) => setForm((f) => ({ ...f, filterType: e.target.value as GiveawayFilterType }))}
            >
              {(Object.keys(FILTER_LABELS) as GiveawayFilterType[]).map((k) => (
                <option key={k} value={k}>{FILTER_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <Input
            label="Custo em pontos (0 = grátis)"
            type="number"
            min={0}
            value={form.costPoints}
            onChange={(e) => setForm((f) => ({ ...f, costPoints: Number(e.target.value) }))}
          />
        </div>
      </Modal>
    </div>
  )
}
