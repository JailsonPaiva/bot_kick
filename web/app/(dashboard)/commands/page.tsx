'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCommands,
  createCommand,
  updateCommand,
  toggleCommand,
  deleteCommand,
} from '@/lib/api/commands'
import type { Command, CreateCommandPayload } from '@/types/commands'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Toggle } from '@/components/ui/Toggle'

const PERMISSIONS = ['everyone', 'subscriber', 'moderator', 'broadcaster']

const emptyForm: CreateCommandPayload = {
  trigger: '',
  response: '',
  aliases: [],
  cooldownSeconds: 30,
  userCooldownSeconds: 60,
  permissionLevel: 'everyone',
}

export default function CommandsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Command | null>(null)
  const [form, setForm] = useState<CreateCommandPayload>(emptyForm)
  const [aliasesRaw, setAliasesRaw] = useState('')

  const { data: commands = [], isLoading } = useQuery({
    queryKey: ['commands'],
    queryFn: fetchCommands,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['commands'] })

  const createMut = useMutation({ mutationFn: createCommand, onSuccess: invalidate })
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateCommandPayload }) =>
      updateCommand(id, payload),
    onSuccess: invalidate,
  })
  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleCommand(id, enabled),
    onSuccess: invalidate,
  })
  const deleteMut = useMutation({ mutationFn: deleteCommand, onSuccess: invalidate })

  function openCreate() {
    setEditTarget(null)
    setForm(emptyForm)
    setAliasesRaw('')
    setModalOpen(true)
  }

  function openEdit(cmd: Command) {
    setEditTarget(cmd)
    setForm({
      trigger: cmd.trigger,
      response: cmd.response,
      aliases: cmd.aliases,
      cooldownSeconds: cmd.cooldownSeconds,
      userCooldownSeconds: cmd.userCooldownSeconds,
      permissionLevel: cmd.permissionLevel,
    })
    setAliasesRaw(cmd.aliases.join(', '))
    setModalOpen(true)
  }

  async function handleSave() {
    const payload = { ...form, aliases: aliasesRaw.split(',').map((a) => a.trim()).filter(Boolean) }
    if (editTarget) {
      await updateMut.mutateAsync({ id: editTarget.id, payload })
    } else {
      await createMut.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Comandos Customizados</h1>
        <Button onClick={openCreate}>+ Novo Comando</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : commands.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
          Nenhum comando criado. Clique em &quot;Novo Comando&quot; para começar.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                {['Trigger', 'Resposta', 'Permissão', 'Cooldown', 'Usos', 'Ativo', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {commands.map((cmd) => (
                <tr key={cmd.id} className="hover:bg-gray-700/20 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-cyan-300">!{cmd.trigger}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">{cmd.response}</td>
                  <td className="px-4 py-3">
                    <Badge variant={cmd.permissionLevel === 'everyone' ? 'gray' : 'blue'}>
                      {cmd.permissionLevel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{cmd.cooldownSeconds}s</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{cmd.usageCount}</td>
                  <td className="px-4 py-3">
                    <Toggle
                      checked={cmd.enabled}
                      onChange={(v) => void toggleMut.mutateAsync({ id: cmd.id, enabled: v })}
                    />
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(cmd)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deleteMut.isPending}
                      onClick={() => void deleteMut.mutateAsync(cmd.id)}
                    >
                      Excluir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editTarget ? 'Editar Comando' : 'Novo Comando'}
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
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Trigger (sem !)"
            placeholder="ex: ola"
            value={form.trigger}
            onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Resposta</label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Use {user}, {count}, {date}, {uptime}"
              value={form.response}
              onChange={(e) => setForm((f) => ({ ...f, response: e.target.value }))}
            />
          </div>
          <Input
            label="Aliases (separados por vírgula)"
            placeholder="ex: olá, hey"
            value={aliasesRaw}
            onChange={(e) => setAliasesRaw(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cooldown global (s)"
              type="number"
              min={0}
              value={form.cooldownSeconds}
              onChange={(e) => setForm((f) => ({ ...f, cooldownSeconds: Number(e.target.value) }))}
            />
            <Input
              label="Cooldown por usuário (s)"
              type="number"
              min={0}
              value={form.userCooldownSeconds}
              onChange={(e) => setForm((f) => ({ ...f, userCooldownSeconds: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Permissão</label>
            <select
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.permissionLevel}
              onChange={(e) => setForm((f) => ({ ...f, permissionLevel: e.target.value }))}
            >
              {PERMISSIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
