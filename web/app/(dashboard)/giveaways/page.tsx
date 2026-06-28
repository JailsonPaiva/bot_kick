'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchGiveaways,
  createGiveaway,
  openGiveaway,
  closeGiveaway,
  drawGiveaway,
  rerollGiveaway,
  deleteGiveaway,
} from '@/lib/api/giveaways'
import type { CreateGiveawayPayload, GiveawayFilter } from '@/types/giveaways'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'

const FILTER_LABELS: Record<GiveawayFilter, string> = {
  all: 'Todos',
  subs: 'Assinantes',
  followers: 'Seguidores',
}

const STATUS_COLORS = {
  pending: 'gray',
  open: 'green',
  closed: 'yellow',
  finished: 'blue',
} as const

const emptyForm: CreateGiveawayPayload = {
  prize: '',
  filter: 'all',
  pointsCost: 0,
}

export default function GiveawaysPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CreateGiveawayPayload>(emptyForm)
  const [winnerMsg, setWinnerMsg] = useState<string | null>(null)

  const { data: giveaways = [], isLoading } = useQuery({
    queryKey: ['giveaways'],
    queryFn: fetchGiveaways,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['giveaways'] })
    setWinnerMsg(null)
  }

  const createMut = useMutation({
    mutationFn: createGiveaway,
    onSuccess: () => { invalidate(); setModalOpen(false) },
  })
  const openMut = useMutation({ mutationFn: openGiveaway, onSuccess: invalidate })
  const closeMut = useMutation({ mutationFn: closeGiveaway, onSuccess: invalidate })
  const drawMut = useMutation({
    mutationFn: drawGiveaway,
    onSuccess: (data) => {
      invalidate()
      setWinnerMsg(`🏆 Vencedor: ${data.winner}`)
    },
  })
  const rerollMut = useMutation({
    mutationFn: rerollGiveaway,
    onSuccess: (data) => {
      invalidate()
      setWinnerMsg(`🎲 Novo vencedor: ${data.winner}`)
    },
  })
  const deleteMut = useMutation({ mutationFn: deleteGiveaway, onSuccess: invalidate })

  const activeGiveaway = giveaways.find((g) => g.status === 'open' || g.status === 'pending')

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Sorteios</h1>
        <Button onClick={() => setModalOpen(true)}>+ Novo Sorteio</Button>
      </div>

      {winnerMsg && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 mb-6 text-center text-yellow-200 text-lg font-semibold">
          {winnerMsg}
        </div>
      )}

      {activeGiveaway && (
        <div className="bg-gray-800 rounded-xl border border-green-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Badge variant={STATUS_COLORS[activeGiveaway.status]}>
                {activeGiveaway.status.toUpperCase()}
              </Badge>
              <h2 className="text-xl font-bold mt-2">{activeGiveaway.prize}</h2>
              <p className="text-sm text-gray-400">
                Filtro: {FILTER_LABELS[activeGiveaway.filter]} ·{' '}
                Custo: {activeGiveaway.pointsCost > 0 ? `${activeGiveaway.pointsCost} pts` : 'Grátis'} ·{' '}
                {activeGiveaway.entryCount ?? 0} participantes
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {activeGiveaway.status === 'pending' && (
                <Button
                  size="sm"
                  variant="success"
                  loading={openMut.isPending}
                  onClick={() => void openMut.mutateAsync(activeGiveaway.id)}
                >
                  Abrir
                </Button>
              )}
              {activeGiveaway.status === 'open' && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={closeMut.isPending}
                    onClick={() => void closeMut.mutateAsync(activeGiveaway.id)}
                  >
                    Encerrar
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={drawMut.isPending}
                    onClick={() => void drawMut.mutateAsync(activeGiveaway.id)}
                  >
                    Sortear
                  </Button>
                </>
              )}
            </div>
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
                {['Prêmio', 'Status', 'Filtro', 'Custo', 'Vencedor', 'Data', 'Ações'].map((h) => (
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
                  <td className="px-4 py-3 text-sm text-gray-400">{FILTER_LABELS[g.filter]}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {g.pointsCost > 0 ? `${g.pointsCost} pts` : 'Grátis'}
                  </td>
                  <td className="px-4 py-3 text-sm text-yellow-400 font-medium">
                    {g.winnerUsername ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(g.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {g.status === 'finished' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={rerollMut.isPending}
                          onClick={() => void rerollMut.mutateAsync(g.id)}
                        >
                          Reroll
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        loading={deleteMut.isPending}
                        onClick={() => void deleteMut.mutateAsync(g.id)}
                      >
                        Excluir
                      </Button>
                    </div>
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
              Criar
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
              value={form.filter}
              onChange={(e) => setForm((f) => ({ ...f, filter: e.target.value as GiveawayFilter }))}
            >
              {(Object.keys(FILTER_LABELS) as GiveawayFilter[]).map((k) => (
                <option key={k} value={k}>{FILTER_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <Input
            label="Custo em pontos (0 = grátis)"
            type="number"
            min={0}
            value={form.pointsCost}
            onChange={(e) => setForm((f) => ({ ...f, pointsCost: Number(e.target.value) }))}
          />
        </div>
      </Modal>
    </div>
  )
}
