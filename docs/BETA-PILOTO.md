# Beta controlado (5–15 streamers)

Checklist operacional para o lote piloto. Não substitui o runbook técnico em `RUNBOOK-PILOTO.md`.

## Antes de convidar o lote

- [ ] `GET /api/health` retorna `ok` ou `degraded` (nunca `down` em DB)
- [ ] JWT e `ADMIN_PASSWORD_HASH` definidos; sem secret default em produção
- [ ] Overlay, comandos, moderação, loyalty, sorteio e enquete testados em staging 72h
- [ ] Snapshot inicial de flags criado por canal
- [ ] Canal de suporte (Discord/WhatsApp) do piloto aberto

## Lote 1 (5 canais)

Dia 0: onboarding + smoke (`!ping`, overlay, criar sorteio teste).
Dias 1–7: revisão diária de `/api/metrics` e `/api/slo`.
Critério para Lote 2: 80% dos canais sem incidente bloqueante.

## Monitoramento diário (15 min)

1. Uptime e reconnects websocket.
2. Erros 5xx por rota.
3. Webhooks `err` vs `ok`.
4. Fila (`queue.failed`).
5. Feedback qualitativo do streamer.

## Encerramento da janela 31–60 dias

Documento: incidentes, MTTR, módulos mais usados, o que cortar/priorizar para 20–50 canais (`docs/SLO.md`).
