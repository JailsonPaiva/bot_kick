'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAlertConfigs, updateAlertConfig, testAlert, fetchOverlayToken } from '@/lib/api/alerts'
import type { AlertConfig } from '@/types/alerts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Badge } from '@/components/ui/Badge'

const ALERT_TYPE_LABELS: Record<string, string> = {
  follow: 'Novo Follow',
  subscription: 'Nova Assinatura',
  gifted_sub: 'Sub Doado',
  raid: 'Raid',
  host: 'Host',
  giveaway_winner: 'Vencedor de Sorteio',
}

const ALERT_EMOJIS: Record<string, string> = {
  follow: '❤️',
  subscription: '⭐',
  gifted_sub: '🎁',
  raid: '⚔️',
  host: '📡',
  giveaway_winner: '🏆',
}

export default function AlertsPage() {
  const queryClient = useQueryClient()
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)
  const [overlayLoading, setOverlayLoading] = useState(false)
  const [testingType, setTestingType] = useState<string | null>(null)

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['alert-configs'],
    queryFn: fetchAlertConfigs,
  })

  const updateMut = useMutation({
    mutationFn: ({ alertType, payload }: { alertType: string; payload: Partial<AlertConfig> }) =>
      updateAlertConfig(alertType, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-configs'] }),
  })

  async function handleTest(alertType: string) {
    setTestingType(alertType)
    try {
      await testAlert(alertType)
    } finally {
      setTestingType(null)
    }
  }

  async function handleGenerateOverlay() {
    setOverlayLoading(true)
    try {
      const result = await fetchOverlayToken()
      setOverlayUrl(result.overlayUrl)
    } finally {
      setOverlayLoading(false)
    }
  }

  const allTypes = [
    'follow', 'subscription', 'gifted_sub', 'raid', 'host', 'giveaway_winner',
  ]

  function getConfig(type: string): AlertConfig | undefined {
    return configs.find((c) => c.alertType === type)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Alertas em Tempo Real</h1>

      {/* Overlay link section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-8">
        <h2 className="text-xl font-semibold mb-2">Link de Overlay (OBS)</h2>
        <p className="text-gray-400 text-sm mb-4">
          Adicione no Browser Source do OBS para exibir alertas em tempo real.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={() => void handleGenerateOverlay()}
            loading={overlayLoading}
            variant="primary"
          >
            Gerar link
          </Button>
          {overlayUrl && (
            <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(overlayUrl)}>
              Copiar
            </Button>
          )}
        </div>
        {overlayUrl && (
          <div className="mt-4 p-3 bg-black/40 border border-gray-700 rounded text-xs break-all text-cyan-200">
            {overlayUrl}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : (
        <div className="grid gap-4">
          {allTypes.map((type) => {
            const cfg = getConfig(type)
            return (
              <AlertCard
                key={type}
                type={type}
                label={ALERT_TYPE_LABELS[type] ?? type}
                emoji={ALERT_EMOJIS[type] ?? '🔔'}
                config={cfg}
                isTesting={testingType === type}
                onToggle={(enabled) =>
                  void updateMut.mutateAsync({ alertType: type, payload: { enabled } })
                }
                onUpdate={(payload) =>
                  void updateMut.mutateAsync({ alertType: type, payload })
                }
                onTest={() => void handleTest(type)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function AlertCard({
  type,
  label,
  emoji,
  config,
  isTesting,
  onToggle,
  onUpdate,
  onTest,
}: {
  type: string
  label: string
  emoji: string
  config: AlertConfig | undefined
  isTesting: boolean
  onToggle: (v: boolean) => void
  onUpdate: (payload: Partial<AlertConfig>) => void
  onTest: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [imageUrl, setImageUrl] = useState(config?.imageUrl ?? '')
  const [message, setMessage] = useState(config?.message ?? '')
  const [durationMs, setDurationMs] = useState(config?.durationMs ?? 5000)

  const enabled = config?.enabled ?? false

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <h3 className="font-semibold">{label}</h3>
            <Badge variant={enabled ? 'green' : 'gray'}>{enabled ? 'Ativo' : 'Inativo'}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            loading={isTesting}
            onClick={onTest}
          >
            Testar
          </Button>
          <Toggle checked={enabled} onChange={onToggle} />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-white text-sm"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
          <Input
            label="URL da imagem"
            placeholder="https://..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Mensagem</label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: {user} deu follow!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Input
            label="Duração (ms)"
            type="number"
            min={1000}
            step={500}
            value={durationMs}
            onChange={(e) => setDurationMs(Number(e.target.value))}
          />
          <Button
            size="sm"
            onClick={() => onUpdate({ imageUrl: imageUrl || null, message: message || null, durationMs })}
          >
            Salvar
          </Button>
        </div>
      )}
    </div>
  )
}
