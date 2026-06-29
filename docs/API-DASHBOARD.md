# API REST e Dashboard Web - Guia de Uso

## Visão Geral

Este repositório contém o **backend** (bot Kick + API REST + WebSocket). O dashboard web é um **projeto frontend separado** que consome a API documentada abaixo.

## API REST

### Documentação Swagger (OpenAPI 3.0)

Com o bot rodando, acesse a documentação interativa:

| URL | Descrição |
|-----|-----------|
| `http://localhost:3001/api/docs` | Swagger UI — testar endpoints no navegador |
| `http://localhost:3001/api/docs/openapi.json` | Spec OpenAPI em JSON |

No Swagger UI, faça login em **Auth → POST /api/auth/login**, copie o `token` e clique em **Authorize** (cadeado) para usar rotas protegidas.

A spec inclui todos os endpoints das Fases 1–4, esquemas de request/response e eventos WebSocket (Socket.io) na descrição geral.

### Configuração

Adicione as variáveis no `.env`:

```bash
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
API_JWT_SECRET=sua-chave-secreta-aqui
ADMIN_PASSWORD_HASH=
WEB_PLAY_URL=http://localhost:3000/play
WEB_OVERLAY_URL=http://localhost:3000/overlay
```

| Variável | Descrição |
|---|---|
| `CORS_ORIGIN` | URL exata do frontend (sem barra final) |
| `WEB_PLAY_URL` | URL base de `/play` para links `!ttt web` no chat |
| `WEB_OVERLAY_URL` | URL base de `/overlay` para Browser Source do OBS |

### Gerar Hash de Senha

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('sua-senha', 10).then(console.log)"
```

Copie o hash gerado e cole em `ADMIN_PASSWORD_HASH`.

### Endpoints Disponíveis

#### Autenticação

**POST /api/auth/login**
```json
{
  "password": "sua-senha"
}
```

Retorna:
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-aqui"
  }
}
```

#### Status do Bot

**GET /api/status**  
Headers: `Authorization: Bearer <token>`

Retorna:
```json
{
  "success": true,
  "data": {
    "online": true,
    "uptime": 123456,
    "activeGames": 2,
    "totalPlayers": 15,
    "version": "3.0.0"
  }
}
```

#### Jogos

**GET /api/games**  
Headers: `Authorization: Bearer <token>`  
Query params: `?page=1&limit=20&gameType=ttt`

**DELETE /api/games/:id**  
Headers: `Authorization: Bearer <token>`  
Cancela partida ativa.

#### Jogadores

**GET /api/players**  
Headers: `Authorization: Bearer <token>`  
Query params: `?page=1&limit=50&search=username`

**GET /api/players/:id**  
Headers: `Authorization: Bearer <token>`

Outros módulos (commands, timers, moderation, loyalty, alerts, giveaways, polls, public ranking) estão documentados no Swagger.

---

## Frontend (projeto separado)

O dashboard não está mais em `web/` neste repositório. Para desenvolvimento local:

1. Clone/inicie o projeto frontend em outro diretório
2. Configure a URL da API no frontend:

```bash
# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3001

# Vite
VITE_API_URL=http://localhost:3001
```

3. Inicie o frontend (`npm run dev`) — tipicamente em `http://localhost:3000`
4. Garanta que `CORS_ORIGIN` no backend aponta para a mesma origem

### Login

Senha padrão em desenvolvimento: `admin`

Em produção, configure `ADMIN_PASSWORD_HASH` no `.env` do bot.

---

## WebSocket

O Socket.io está ativo na mesma porta da API (3001). Conecte-se para receber eventos em tempo real:

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001')

socket.on('game:start', (data) => {
  console.log('Nova partida iniciada:', data)
})

socket.on('game:move', (data) => {
  console.log('Jogada realizada:', data)
})

socket.on('rank:update', (data) => {
  console.log('Ranking atualizado:', data)
})
```

### Overlay OBS (alertas)

1. Gere token via `GET /api/alerts/overlay-token` (autenticado)
2. Abra `{WEB_OVERLAY_URL}/{token}` no Browser Source do OBS
3. O overlay conecta via `join:alerts` e recebe `alert:event`

---

## Estrutura de Arquivos (backend)

```
src/
├── api/
│   ├── types.ts
│   ├── auth.ts
│   ├── server.ts
│   ├── swagger.ts
│   ├── openapi/spec.ts
│   └── routes/
│       ├── auth.ts
│       ├── status.ts
│       ├── games.ts
│       ├── players.ts
│       ├── commands.ts
│       ├── timers.ts
│       ├── moderation.ts
│       ├── loyalty.ts
│       ├── alerts.ts
│       ├── giveaways.ts
│       ├── polls.ts
│       └── public.ts
├── bot.ts
└── ...
```

---

## Documentação relacionada

- [Deploy em produção](DEPLOY-PRODUCAO.md)
- [Guia rápido](../START.md)
