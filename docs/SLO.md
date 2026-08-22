# SLOs — piloto e expansão 20–50 canais

Valores também expostos em `GET /api/slo` (`src/ops/slo.ts`).

| Indicador | Alvo piloto | Alvo 20–50 canais |
|---|---|---|
| Disponibilidade API (não-5xx) | 99% | 99.5% |
| p95 rotas autenticadas | ≤ 500 ms | ≤ 300 ms |
| Taxa de erro de webhook | ≤ 2% | ≤ 1% |
| WebSocket connected durante live | ≥ 95% do tempo | ≥ 99% |
| MTTR incidente P1 | ≤ 30 min | ≤ 15 min |

## Orçamento de erro

Se `/api/slo` marcar `passing.apiAvailability=false` por 15 minutos, abrir incidente e congelar rollout de novos canais.

## Otimizações previstas pós-piloto

- Índice/consulta de ranking e loyalty sob carga.
- Persistência Redis da fila (hoje in-process).
- Separar processo API vs listener se um canal saturar CPU.
- Cache de config de moderação/comandos por canal.

## Feature flags

Desligar módulo por canal (`PUT /api/ops/flags`) é o primeiro controle de blast radius antes de rollback de release.
