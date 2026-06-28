'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPolls, createPoll, fetchPollById, closePoll } from '@/lib/api/polls'
import type { CreatePollPayload, Poll } from '@/types/polls'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Toggle } from '@/components/ui/Toggle'

const emptyForm: CreatePollPayload = {
  question: '',
  options: ['', ''],
  durationS: 300,
  weightedSubs: false,
}

export default function PollsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CreatePollPayload>(emptyForm)
  const [activePollId, setActivePollId] = useState<string | null>(null)

  const { data: polls = [], isLoading } = useQuery({
    queryKey: ['polls'],
    queryFn: fetchPolls,
  })

  const { data: activePollData } = useQuery({
    queryKey: ['poll-status', activePollId],
    queryFn: () => fetchPollById(activePollId!),
    enabled: !!activePollId,
    refetchInterval: 5000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['polls'] })

  const createMut = useMutation({
    mutationFn: createPoll,
    onSuccess: (data) => {
      invalidate()
      setModalOpen(false)
      setActivePollId(data.id)
    },
  })

  const closeMut = useMutation({
    mutationFn: closePoll,
    onSuccess: () => {
      invalidate()
      setActivePollId(null)
    },
  })

  function addOption() {
    setForm((f) => ({ ...f, options: [...f.options, ''] }))
  }

  function removeOption(i: number) {
    setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))
  }

  function updateOption(i: number, v: string) {
    setForm((f) => {
      const opts = [...f.options]
      opts[i] = v
      return { ...f, options: opts }
    })
  }

  const openPolls = polls.filter((p) => p.status === 'open')
  const closedPolls = polls.filter((p) => p.status === 'closed')

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Enquetes</h1>
        <Button onClick={() => setModalOpen(true)} disabled={openPolls.length > 0}>
          + Nova Enquete
        </Button>
      </div>

      {activePollId && activePollData && (
        <div className="bg-gray-800 rounded-xl border border-green-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Badge variant="green">Ao vivo</Badge>
              <h2 className="text-xl font-bold mt-2">{activePollData.question}</h2>
              <p className="text-sm text-gray-400">{activePollData.totalVotes ?? 0} voto(s)</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setActivePollId(null)}>
                Fechar painel
              </Button>
              {activePollData.status === 'open' && (
                <Button
                  size="sm"
                  variant="danger"
                  loading={closeMut.isPending}
                  onClick={() => void closeMut.mutateAsync()}
                >
                  Encerrar enquete
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {(activePollData.results ?? []).map((opt) => (
              <div key={opt.option}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-200">{opt.option}. {opt.text}</span>
                  <span className="text-gray-400 font-medium">
                    {opt.score} voto(s) · {opt.percentage ?? 0}%
                  </span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${opt.percentage ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : polls.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
          Nenhuma enquete criada ainda.
        </div>
      ) : (
        <div className="space-y-4">
          {openPolls.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-green-400">Em aberto</h2>
              {openPolls.map((poll) => (
                <PollRow
                  key={poll.id}
                  poll={poll}
                  onView={() => setActivePollId(poll.id)}
                  onClose={() => void closeMut.mutateAsync()}
                  closing={closeMut.isPending}
                />
              ))}
            </div>
          )}
          {closedPolls.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-gray-400">Encerradas</h2>
              {closedPolls.map((poll) => (
                <PollRow key={poll.id} poll={poll} onView={() => setActivePollId(poll.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        title="Nova Enquete"
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              loading={createMut.isPending}
              onClick={() => void createMut.mutateAsync({
                ...form,
                options: form.options.filter((o) => o.trim() !== ''),
              })}
            >
              Criar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Pergunta"
            placeholder="Ex: Qual personagem devo jogar agora?"
            value={form.question}
            onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          />
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Opções</label>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Opção ${i + 1}`}
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                  />
                  {form.options.length > 2 && (
                    <Button size="sm" variant="danger" onClick={() => removeOption(i)}>✕</Button>
                  )}
                </div>
              ))}
              {form.options.length < 8 && (
                <Button size="sm" variant="secondary" onClick={addOption}>+ Opção</Button>
              )}
            </div>
          </div>
          <Input
            label="Duração (segundos, mínimo 15)"
            type="number"
            min={15}
            value={form.durationS}
            onChange={(e) => setForm((f) => ({ ...f, durationS: Number(e.target.value) }))}
          />
          <div className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
            <span className="text-sm text-gray-300">Peso extra para assinantes (x2)</span>
            <Toggle
              checked={!!form.weightedSubs}
              onChange={(v) => setForm((f) => ({ ...f, weightedSubs: v }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PollRow({
  poll,
  onView,
  onClose,
  closing = false,
}: {
  poll: Poll
  onView: () => void
  onClose?: () => void
  closing?: boolean
}) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center justify-between mb-3">
      <div>
        <p className="font-medium">{poll.question}</p>
        <p className="text-sm text-gray-400">
          {poll.options.length} opções ·{' '}
          {poll.status === 'open' ? (
            <span className="text-green-400">Em aberto</span>
          ) : (
            <span className="text-gray-500">Encerrada</span>
          )}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onView}>Ver resultados</Button>
        {poll.status === 'open' && onClose && (
          <Button size="sm" variant="danger" loading={closing} onClick={onClose}>
            Encerrar
          </Button>
        )}
      </div>
    </div>
  )
}
