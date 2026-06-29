# Changelog — Kick Bot

## [4.1.0] - 2026-06-28 - Separação frontend/backend

### Removido
- Pasta `web/` deste repositório — frontend agora é projeto/repositório separado

### Modificado
- `.gitignore` — removidas entradas de `web/`
- `.env.example` — URLs padrão apontam para frontend externo (`localhost:3000`)
- `package.json` — removidos scripts `dev:web` e `build:web`
- Defaults de `CORS_ORIGIN`, `WEB_PLAY_URL` e `WEB_OVERLAY_URL` atualizados para `localhost:3000`
- Documentação atualizada: `README.md`, `START.md`, `docs/API-DASHBOARD.md`, `docs/DEPLOY-PRODUCAO.md`, `roadmap.md`

---

## [3.0.0] - 2026-06-21 - Fase 3: API e Dashboard Web

### Adicionado

#### API REST Completa
- Servidor Express integrado rodando na porta 3001
- Autenticação JWT com middleware
- Endpoints:
  - `POST /api/auth/login` — Login com senha
  - `GET /api/status` — Status do bot (online, uptime, partidas ativas)
  - `GET /api/games` — Histórico de partidas (paginado)
  - `DELETE /api/games/:id` — Cancelar partida ativa
  - `GET /api/players` — Ranking de jogadores (paginado, com busca)
  - `GET /api/players/:id` — Dados de um jogador específico
  - `GET /api/health` — Health check
  - `GET /` — Documentação da API

#### WebSocket (Socket.io)
- Servidor Socket.io na mesma porta da API (3001)
- Preparado para eventos em tempo real:
  - `game:start` — Nova partida iniciada
  - `game:move` — Jogada realizada
  - `rank:update` — Ranking atualizado

#### Dashboard Web (React + Vite + TypeScript)
- Setup completo do projeto em `web/`
- Dependências: React 18, React Router, TanStack Query, Socket.io Client, Tailwind CSS
- Páginas:
  - **Login**: Autenticação via API
  - **Dashboard**: Status ao vivo, uptime, estatísticas
  - **Jogos**: Histórico de partidas com filtros
  - **Ranking**: Top jogadores com pontos, vitórias, derrotas
- Componentes:
  - Layout com navegação e logout
  - Cards de estatísticas
  - Tabelas responsivas

#### Configurações
- Novas variáveis `.env`:
  - `API_PORT` — Porta da API (padrão: 3001)
  - `CORS_ORIGIN` — Origem permitida (padrão: http://localhost:5173)
  - `API_JWT_SECRET` — Chave secreta JWT
  - `ADMIN_PASSWORD_HASH` — Hash bcrypt da senha do admin

#### Documentação
- `docs/API-DASHBOARD.md` — Guia completo da API e Dashboard
- `CHANGELOG.md` — Este arquivo
- `README.md` atualizado com instruções da Fase 3

### Modificado
- `src/bot.ts` — Integrado servidor API e Socket.io
- `.env.example` — Adicionadas novas variáveis
- `package.json` — Adicionadas dependências: socket.io, jsonwebtoken, bcryptjs, cors

### Estrutura Nova
```
src/api/
├── types.ts
├── auth.ts
├── server.ts
├── index.ts
└── routes/
    ├── auth.ts
    ├── status.ts
    ├── games.ts
    └── players.ts

web/
├── src/
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Games.tsx
│   │   └── Ranking.tsx
│   ├── components/
│   │   └── Layout.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── style.css
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .env.example
```

### Pendente (Roadmap Fase 3+)
- Interface web para jogadores (jogo da velha no browser)
- Mini game Quiz/Trivia (`!quiz`)
- Integração CS2 com RCON para lobby
- OBS Overlays (ranking ao vivo, partida atual)
- Adapter Valorant/LOL com Riot API

---

## [2.5.0] - Fase 2.5: Polimento

### Adicionado
- Recovery automático de partidas ativas ao reiniciar bot
- Prefixo `[BOT]` configurável nas mensagens
- Testes unitários (18 testes passando)
- Helper `tttService.ts` para lógica de registro de jogadores

### Modificado
- `gameManager.recoverActiveGames()` — Validação robusta de estado
- `tttRenderer.ts` — Mensagens com pontos ganhos
- Mensagens de erro mais amigáveis

---

## [2.4.0] - Fase 2.4: Ranking

### Adicionado
- Comandos `!rank`, `!rank me`, `!rank @usuario`
- Sistema de pontos: +3 vitória, +1 empate, 0 derrota
- `PlayerRepository.findByUsernameOrSlug()` — Busca case-insensitive

---

## [2.3.0] - Fase 2.3: Jogo da Velha

### Adicionado
- Jogo da velha funcional via chat
- Comandos: `!ttt join`, `!ttt 1-9`, `!ttt board`, `!ttt forfeit`, `!ttt help`
- Lógica pura em `tttGame.ts` (testável isoladamente)
- Renderer ASCII para chat
- Timeout de inatividade (5 min)
- Persistência de partidas no SQLite

---

## [2.2.0] - Fase 2.2: Game Engine

### Adicionado
- `GameManager` — Orquestrador de partidas ativas
- `CooldownManager` — Anti-spam por usuário
- `GameRegistry` — Sistema plugável de mini games
- Demo game (`!demo start/join/status/end`)

---

## [2.1.0] - Fase 2.1: Fundação

### Adicionado
- SQLite com migrations
- `PlayerRepository` e `GameRepository`
- Router de comandos modular
- Configuração centralizada em `gameConfig.ts`

---

## [1.0.0] - MVP: OAuth + Echo

### Inicial
- OAuth 2.1 + PKCE
- WebSocket Pusher para leitura de chat
- Envio de mensagens via API oficial da Kick
- Comandos: `!echo`, `!ping`, `!auth`
- Persistência de tokens em `.tokens.json`
