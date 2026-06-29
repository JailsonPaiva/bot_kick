# Kick Bot — OAuth 2.1 + Echo Test (MVP)

Bot para a plataforma [Kick.com](https://kick.com) que valida autenticação OAuth e leitura/escrita no chat via comandos de echo.

## Pré-requisitos

- **Node.js 20+**
- Conta Kick com acesso ao [Developer Portal](https://kick.com/settings/developer)
- npm

## Configuração do app na Kick

1. Acesse [kick.com/settings/developer](https://kick.com/settings/developer)
2. Crie um novo aplicativo
3. Configure a **Redirect URL** como:
   ```
   http://localhost:3000/callback
   ```
4. Anote o **Client ID** e **Client Secret**
5. Garanta que os scopes `user:read`, `channel:read` e `chat:write` estão habilitados

## Instalação e execução

```bash
# Copie e preencha as variáveis de ambiente
cp .env.example .env

# Instale dependências e inicie o bot
npm install
npm run dev
```

Na primeira execução, o bot abrirá o browser para autorização OAuth. Após aprovar, os tokens são salvos em `.tokens.json` e reutilizados nas próximas execuções.

### Infra de escala (Passo 1)

O projeto agora inclui base para evolução com PostgreSQL + Redis + Prisma, sem quebrar o fluxo atual.

```bash
# Subir PostgreSQL e Redis
npm run db:up

# Gerar cliente Prisma
npm run prisma:generate
```

Variáveis necessárias no `.env`:

- `DATABASE_URL=postgresql://kick_bot:kick_bot@localhost:5432/kick_bot?schema=public`
- `REDIS_URL=redis://localhost:6379`

### Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `KICK_CLIENT_ID` | Client ID do app Kick |
| `KICK_CLIENT_SECRET` | Client Secret do app Kick |
| `KICK_CHANNEL_SLUG` | Slug do canal — parte da URL após `kick.com/` (ex: `unao-da-firma`) |
| `KICK_BOT_SLUG` | Slug da conta do bot (para ignorar mensagens próprias) |
| `KICK_CHATROOM_ID` | ID numérico do chatroom (veja seção abaixo se receber HTTP 403) |

### Como descobrir o `KICK_CHANNEL_SLUG`

O slug **não é necessariamente** o nome de exibição da sua conta. É o identificador na URL do canal:

1. Abra seu canal no browser (ex: `https://kick.com/unao-da-firma`)
2. Copie só a parte depois de `kick.com/` → `unao-da-firma`
3. Use **hífens** (`-`), não underscores (`_`)

### Como obter o `KICK_CHATROOM_ID` (se der erro 403)

A Kick protege `kick.com/api/v2/channels/...` com Cloudflare. Requisições do Node.js costumam receber **403**, mesmo com slug correto. Solução:

1. No **browser**, acesse: `https://kick.com/api/v2/channels/<seu-slug>`
2. No JSON, encontre: `"chatroom": { "id": 123456 }`
3. Adicione no `.env`: `KICK_CHATROOM_ID=123456`
4. Rode `npm run dev` novamente

## Comandos no chat

| Comando | Resposta |
|---|---|
| `!echo <texto>` | Repete o texto informado |
| `!ping` | `@<username> pong! 🏓` |
| `!auth` | `@<username> autenticado como <bot_slug> ✅` |
| `!demo start` | Inicia partida demo (aguarda oponente) — valida o Game Engine |
| `!demo join` | Entra como oponente na partida demo |
| `!demo status` | Mostra status da partida demo |
| `!demo end` | Encerra partida demo |
| `!ttt join` | Cria ou entra em partida de jogo da velha |
| `!ttt 1-9` | Joga na posição do tabuleiro |
| `!ttt board` | Exibe o tabuleiro atual |
| `!ttt forfeit` | Desiste da partida |
| `!rank` | Top 10 do ranking (pontos, vitórias, empates, derrotas) |
| `!rank me` | Suas estatísticas no ranking |
| `!rank @usuario` | Estatísticas de um jogador específico |

## Fluxo OAuth (resumo)

OAuth é o protocolo que permite ao bot agir em nome da sua conta Kick sem expor sua senha.

1. O bot gera um par PKCE (`code_verifier` + `code_challenge`) e abre o browser
2. Você autoriza o app na página da Kick
3. A Kick redireciona para `localhost:3000/callback` com um `code` temporário
4. O bot troca esse `code` por `access_token` + `refresh_token`
5. Tokens são salvos em `.tokens.json` e renovados automaticamente antes de expirar

PKCE garante que apenas quem iniciou o fluxo pode completá-lo — proteção extra contra interceptação do `code`.

## Arquitetura

```
src/
├── auth/       OAuth 2.1 PKCE, refresh de tokens, persistência local
├── chat/       WebSocket Pusher (leitura) + API REST (escrita)
├── commands/   Parser, router e handlers de comando
├── config/     Configuração de jogos (timeouts, cooldowns)
├── db/         SQLite, migrations e repositories
├── games/      Engine de mini games, registry e demo mock
├── utils/      Logger, helpers de env
└── bot.ts      Entrypoint (wiring)
```

## Scripts npm

| Script | Descrição |
|---|---|
| `npm run dev` | Executa o bot com tsx (desenvolvimento) |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Executa a versão compilada |
| `npm test` | Executa testes unitários e de integração |
| `npm run db:up` | Sobe PostgreSQL e Redis via Docker Compose |
| `npm run db:down` | Derruba infraestrutura local |
| `npm run prisma:generate` | Gera Prisma Client |
| `npm run prisma:migrate:dev` | Cria/aplica migrations Prisma em dev |

## Fase 2 — Completa ✅

- Jogo da velha funcional (`!ttt`)
- Sistema de ranking com pontos persistentes
- Recovery automático de partidas
- Testes unitários

## Fase 3 — API REST 🚀

### API REST

O bot expõe uma API REST completa:

- **Autenticação JWT** para dashboard admin
- **Endpoints** de status, jogos, ranking, moderação, loyalty, alertas, sorteios e enquetes
- **WebSocket** (Socket.io) para atualizações em tempo real
- **Swagger** em `/api/docs`

Consulte [docs/API-DASHBOARD.md](docs/API-DASHBOARD.md) para detalhes.

Para deploy em produção com custo zero, veja [docs/DEPLOY-PRODUCAO.md](docs/DEPLOY-PRODUCAO.md).

### Frontend (repositório separado)

O dashboard web **não faz parte deste repositório**. Ele consome a API via HTTP/WebSocket.

Configure no `.env` do backend as URLs do seu frontend:

```bash
CORS_ORIGIN=http://localhost:3000
WEB_PLAY_URL=http://localhost:3000/play
WEB_OVERLAY_URL=http://localhost:3000/overlay
```

Contrato da API: `http://localhost:3001/api/docs` (Swagger).

### Próximos Passos

Planejamento completo em `.cursor/plans/evolução_bot_kick_fase_3_*.plan.md`:

- Interface web para jogadores jogarem jogo da velha
- Mini game Quiz/Trivia
- Integração CS2/Valorant/LOL
- OBS Overlays
