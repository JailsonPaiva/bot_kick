'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchModerationConfig,
  updateModerationConfig,
  fetchModerationLogs,
} from '@/lib/api/moderation'
import type { UpdateModerationPayload } from '@/types/moderation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Badge } from '@/components/ui/Badge'

type Tab = 'config' | 'logs'

export default function ModerationPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('config')
  const [logPage, setLogPage] = useState(1)
  const LOG_LIMIT = 20

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['moderation-config'],
    queryFn: fetchModerationConfig,
  })

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['moderation-logs', logPage],
    queryFn: () => fetchModerationLogs({ page: logPage, limit: LOG_LIMIT }),
    enabled: tab === 'logs',
  })

  const [form, setForm] = useState<UpdateModerationPayload>({})
  const [saved, setSaved] = useState(false)

  const saveMut = useMutation({
    mutationFn: () => updateModerationConfig(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  function field<K extends keyof UpdateModerationPayload>(key: K): UpdateModerationPayload[K] {
    if (key in form && form[key] !== undefined) return form[key] as UpdateModerationPayload[K]
    return config?.[key as keyof typeof config] as unknown as UpdateModerationPayload[K]
  }

  function setField<K extends keyof UpdateModerationPayload>(key: K, val: UpdateModerationPayload[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  if (configLoading) return <div className="text-center py-8 text-gray-400">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Moderação</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('config')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'config' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Configurações
          </button>
          <button
            onClick={() => setTab('logs')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'logs' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Logs
          </button>
        </div>
      </div>

      {tab === 'config' && (
        <div className="space-y-6">
          <Section title="Filtro de Links">
            <Toggle
              checked={!!field('blockLinks')}
              onChange={(v) => setField('blockLinks', v)}
              label="Bloquear links"
            />
            <div className="mt-3">
              <label className="text-sm text-gray-400 block mb-1">Whitelist (um por linha)</label>
              <textarea
                rows={3}
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="kick.com&#10;youtube.com"
                value={(field('linkWhitelist') as string[] | undefined ?? []).join('\n')}
                onChange={(e) => setField('linkWhitelist', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
              />
            </div>
          </Section>

          <Section title="Filtro de Caps">
            <Toggle
              checked={!!field('blockCaps')}
              onChange={(v) => setField('blockCaps', v)}
              label="Bloquear excesso de maiúsculas"
            />
            <div className="mt-3">
              <Input
                label="Threshold (%)"
                type="number"
                min={0}
                max={100}
                value={field('capsThreshold') as number | undefined ?? 70}
                onChange={(e) => setField('capsThreshold', Number(e.target.value))}
              />
            </div>
          </Section>

          <Section title="Filtro de Spam">
            <Toggle
              checked={!!field('blockSpam')}
              onChange={(v) => setField('blockSpam', v)}
              label="Bloquear spam"
            />
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Input
                label="Janela (s)"
                type="number"
                min={1}
                value={field('spamWindowSeconds') as number | undefined ?? 10}
                onChange={(e) => setField('spamWindowSeconds', Number(e.target.value))}
              />
              <Input
                label="Máx. mensagens"
                type="number"
                min={1}
                value={field('spamMaxMessages') as number | undefined ?? 5}
                onChange={(e) => setField('spamMaxMessages', Number(e.target.value))}
              />
            </div>
          </Section>

          <Section title="Palavras Banidas">
            <label className="text-sm text-gray-400 block mb-1">Uma por linha</label>
            <textarea
              rows={4}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={(field('bannedWords') as string[] | undefined ?? []).join('\n')}
              onChange={(e) => setField('bannedWords', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
            />
          </Section>

          <Section title="Mensagem de Aviso">
            <Input
              placeholder="Ex: @{user}, esse conteúdo não é permitido aqui."
              value={field('warnMessage') as string | undefined ?? ''}
              onChange={(e) => setField('warnMessage', e.target.value)}
            />
          </Section>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => void saveMut.mutateAsync()}
              loading={saveMut.isPending}
            >
              Salvar configurações
            </Button>
            {saved && <span className="text-green-400 text-sm">Salvo!</span>}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div>
          {logsLoading ? (
            <div className="text-center py-8 text-gray-400">Carregando...</div>
          ) : !logsData || logsData.logs.length === 0 ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400">
              Nenhum log de moderação.
            </div>
          ) : (
            <>
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-4">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      {['Usuário', 'Motivo', 'Mensagem', 'Ação', 'Data'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {logsData.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-700/20">
                        <td className="px-4 py-3 text-sm font-medium text-cyan-300">{log.username}</td>
                        <td className="px-4 py-3"><Badge variant="yellow">{log.reason}</Badge></td>
                        <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">{log.message}</td>
                        <td className="px-4 py-3"><Badge variant="red">{log.action}</Badge></td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
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
                  disabled={logPage <= 1}
                  onClick={() => setLogPage((p) => p - 1)}
                >
                  ← Anterior
                </Button>
                <span className="text-sm text-gray-400 self-center">Página {logPage}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={logsData.logs.length < LOG_LIMIT}
                  onClick={() => setLogPage((p) => p + 1)}
                >
                  Próxima →
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </div>
  )
}
