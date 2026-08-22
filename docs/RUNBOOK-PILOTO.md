# Runbook operacional — piloto Kick Bot

## Objetivo

Operar o beta com 5–15 streamers, detectar falhas rápido e restaurar o canal sem downtime longo.

## Endpoints de diagnóstico

| Uso | Rota |
|---|---|
| Health profundo | `GET /api/health` (503 se dependência crítica down) |
| Status + versão | `GET /api/status` |
| Métricas | `GET /api/metrics` |
| SLOs | `GET /api/slo` |
| Checklist piloto | `GET /api/ops/pilot` (JWT) |
| Feature flags | `GET/PUT /api/ops/flags` (JWT) |
| Snapshots | `GET/POST /api/ops/snapshots` e `POST /api/ops/snapshots/:id/restore` |
| Viewers (timers) | `PUT /api/ops/viewers` `{ channelSlug, viewerCount }` |

## Incidente: API fora

1. Conferir `GET /api/health`.
2. Se `database=down`, validar Postgres e `DATABASE_URL`.
3. Se `websocket=down`, o bot perdeu Pusher — aguardar reconnect automático (backoff até 30s).
4. Reiniciar processo só se reconnect não voltar em 2 minutos: `npm run start`.

## Incidente: comandos pararam em um canal

1. `GET /api/ops/flags?channel=<slug>` — módulo `commands` pode estar off.
2. Restaurar snapshot: `POST /api/ops/snapshots/:id/restore`.
3. Conferir logs JSON (`module`, `channelSlug`, `requestId`).

## Incidente: webhooks duplicados ou 401

1. Duplicado: resposta `{ duplicate: true }` é esperada (idempotência por `Kick-Event-Message-Id`).
2. 401: conferir chave pública e `KICK_WEBHOOK_SKIP_VERIFY` (nunca `true` em produção).

## Degradação aceitável

- Redis down: bot segue; idempotência fica só em memória.
- `minViewers` alto: timers silenciam até `PUT /api/ops/viewers`.

## Rollback de config

Antes de mudar flags/regras no piloto, criar snapshot. Se o canal reclamar, restaurar o último snapshot do módulo `flags`.

## MTTR alvo

Incidentes P1 (chat/comandos/overlay down): < 30 minutos em horário de live.
