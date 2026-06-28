'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchTimers,
  createTimer,
  updateTimer,
  toggleTimer,
  deleteTimer,
} from '@/lib/api/timers'
import type { Timer, CreateTimerPayload } from '@/types/timers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'

const emptyForm: CreateTimerPayload = {
  name: '',
  messages: [''],
  intervalMinutes: 5,
}

export default function TimersPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Timer | null>(null)
  const [form, setForm] = useState<CreateTimerPayload>(emptyForm)

  const { data: timers = [], isLoading } = useQuery({
    queryKey: ['timers'],
    queryFn: fetchTimers,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['timers'] })

  const createMut = useMutation({ mutationFn: createTimer, onSuccess: invalidate })
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateTimerPayload }) =>
      updateTimer(id, payload),
    onSuccess: invalidate,
  })
  const toggleMut = useMutation({
    mutationFn: (id: string) => toggleTimer(id),
    onSuccess: invalidate,
  })
  const deleteMut = useMutation({ mutationFn: deleteTimer, onSuccess: invalidate })

  function openCreate() {
    setEditTarget(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(t: Timer) {
    setEditTarget(t)
    setForm({ name: t.name, messages: t.messages, intervalMinutes: t.intervalMinutes })
    setModalOpen(true)
  }

  async function handleSave() {
    const cleanMessages = form.messages.filter((m) => m.trim() !== '')
    const payload = { ...form, messages: cleanMessages }
    if (editTarget) {
      await updateMut.mutateAsync({ id: editTarget.id, payload })
    } else {
      await createMut.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  function addMessage() {
    setForm((f) => ({ ...f, messages: [...f.messages, ''] }))
  }

  function removeMessage(i: number) {
    setForm((f) => ({ ...f, messages: f.messages.filter((_, idx) => idx !== i) }))
  }

  function updateMessage(i: number, value: string) {
    setForm((f) => {
      const msgs = [...f.messages]
      msgs[i] = value
      return { ...f, messages: msgs }
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Timers</h1>
        <Button onClick={openCreate}>+ Novo Timer</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : timers.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
          Nenhum timer criado.
        </div>
      ) : (
        <div className="grid gap-4">
          {timers.map((t) => (
            <div key={t.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{t.name}</h3>
                  <p className="text-sm text-gray-400">
                    A cada {t.intervalMinutes} min ·{' '}
                    {t.messages.length} mensagem{t.messages.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={t.isActive}
                    onChange={() => void toggleMut.mutateAsync(t.id)}
                  />
                  <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void deleteMut.mutateAsync(t.id)}
                    loading={deleteMut.isPending}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                {t.messages.map((msg, i) => (
                  <div
                    key={i}
                    className="text-sm text-gray-300 bg-gray-700/40 rounded px-3 py-1.5 truncate"
                  >
                    {i + 1}. {msg}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editTarget ? 'Editar Timer' : 'Novo Timer'}
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={createMut.isPending || updateMut.isPending}
              onClick={() => void handleSave()}
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome do timer"
            placeholder="ex: promocao"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Intervalo (minutos)"
            type="number"
            min={1}
            value={form.intervalMinutes}
            onChange={(e) => setForm((f) => ({ ...f, intervalMinutes: Number(e.target.value) }))}
          />
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">
              Mensagens (rotativas, em ordem)
            </label>
            <div className="space-y-2">
              {form.messages.map((msg, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Mensagem ${i + 1}`}
                    value={msg}
                    onChange={(e) => updateMessage(i, e.target.value)}
                  />
                  {form.messages.length > 1 && (
                    <Button size="sm" variant="danger" onClick={() => removeMessage(i)}>
                      ✕
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" className="mt-2" onClick={addMessage}>
              + Adicionar mensagem
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
