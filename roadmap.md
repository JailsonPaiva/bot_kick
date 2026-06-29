# Kick Bot — Roadmap de desenvolvimento

> Base tecnológica: **Next.js** (frontend) · **Nest.js** (backend) · **PostgreSQL** · **Redis** · **Prisma ORM**

---

## Contexto e ponto de partida

O projeto já possui conexão ativa com a Kick via WebSocket, reconhecimento de comandos no chat e resposta automática do bot. A primeira validação foi um jogo da velha multiplayer em tempo real entre dois viewers, com ranking persistido em banco de dados — confirmando que a arquitetura suporta interação direta entre viewers orquestrada pelo bot.

As fases a seguir constroem sobre essa base para transformar o bot em uma solução completa e competitiva para streamers na Kick.

---

## Arquitetura geral

```
kick-bot/                 ← este repositório (bot + API REST + WebSocket)
  src/
    api/                  ← Express, Swagger, Socket.io
    bot.ts
    commands/
    games/
    ...

kick-bot-web/             ← repositório frontend separado (Next.js)
  app/
    dashboard/            ← área autenticada do streamer
    overlay/[token]/      ← browser source para OBS (pública)
    ranking/[canal]/      ← página pública de ranking
    play/                 ← páginas de jogo para viewers
```

**Infra de suporte:**

- **Redis** — cache de config por canal, filas Bull, pub/sub entre serviços
- **Docker Compose** — ambiente de dev unificado (Postgres + Redis + apps)
- **Variáveis de ambiente** — `.env` separado por app, nunca commitado

---

## Fase 1 — Fundação do bot e autenticação

> **Objetivo:** bot conectado, autenticado e com dashboard acessível. Sem essa fase nada funciona.

### Nest.js — Kick Bot Service

- Conexão WebSocket com a Kick API (protocolo Pusher)
- Listener de eventos: `chat.message`, `channel.follow`, `channel.subscription`, `channel.kicks_given`
- Parser de comandos por prefixo configurável (padrão `!`)
- Rate limiter por usuário e por canal para evitar flood de respostas
- Reconexão automática com backoff exponencial ao perder conexão
- `BotModule` com `KickService` injetável nos demais módulos

### Nest.js — Auth Module

- OAuth 2.0 com Kick para autorizar o bot a operar no canal do streamer
- JWT para autenticação do streamer no dashboard
- Refresh token flow para manter sessão ativa
- `JwtAuthGuard` protegendo todas as rotas do dashboard
- Tabela de canais com token de acesso criptografado

### Next.js — Onboarding UI

- Página de login e autorização com Kick
- Tela de setup inicial: nome do bot, prefixo de comandos, fuso horário
- Status de conexão em tempo real (online / reconectando / offline)
- Middleware de autenticação via Next Auth ou solução própria com JWT

### Schema inicial (Prisma)

```prisma
model Channel {
  id              String   @id @default(uuid())
  kickChannelId   String   @unique
  kickAccessToken String
  botPrefix       String   @default("!")
  timezone        String   @default("UTC")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model User {
  id          String  @id @default(uuid())
  kickUserId  String  @unique
  username    String
  displayName String
}

model BotSession {
  id          String   @id @default(uuid())
  channelId   String
  status      String
  connectedAt DateTime @default(now())
}
```

**Entregável:** bot conecta ao canal, responde `!ping` com `pong`, dashboard abre com status de conexão visível.

---

## Fase 2 — Comandos customizáveis e moderação

> **Objetivo:** primeira feature visível e utilizável ao vivo pelo streamer — sem precisar tocar em código.

### Nest.js — Commands Module

- CRUD completo de comandos por canal
- Variáveis dinâmicas suportadas: `{user}`, `{count}`, `{uptime}`, `{date}`, `{viewers}`
- Cooldown global (canal) e individual (por usuário)
- Níveis de permissão: `everyone` / `subscribers` / `moderators` / `broadcaster`
- Alias: múltiplos gatilhos para um mesmo comando
- Comandos built-in pré-configurados: `!uptime`, `!sociais`, `!rank`, `!pontos`

### Nest.js — Timers Module

- Mensagens agendadas com intervalo configurável em minutos
- Condição mínima de viewers para o timer disparar (ex: só envia se tiver 5+ viewers)
- Bull queue para gerenciamento dos timers em background
- Rotação de mensagens (lista circular) para não repetir sempre a mesma

### Nest.js — Moderation Module

- Filtro de links com whitelist por domínio
- Filtro de caps: percentual máximo de letras maiúsculas configurável
- Filtro de spam: detecção de mensagens repetidas em sequência
- Filtro de palavras proibidas com suporte a expressões parciais
- Ações configuráveis: `deletar mensagem` / `timeout (duração)` / `ban`
- Log de todas as ações de moderação com timestamp e motivo

### Next.js — Dashboard de Comandos

- Lista de comandos com toggle ativo/inativo sem sair da página
- Formulário de criação e edição inline com preview da resposta
- Seção de timers com visualização da fila de próximos disparos
- Config de moderação organizada por categoria de filtro
- Contador de uso por comando (quantas vezes foi acionado)

### Schema adicional

```prisma
model Command {
  id         String  @id @default(uuid())
  channelId  String
  trigger    String
  aliases    String[]
  response   String
  permission String  @default("everyone")
  cooldown   Int     @default(5)
  usageCount Int     @default(0)
  isActive   Boolean @default(true)
}

model Timer {
  id             String  @id @default(uuid())
  channelId      String
  messages       String[]
  intervalMinutes Int
  minViewers     Int     @default(0)
  isActive       Boolean @default(true)
}

model ModerationConfig {
  id              String  @id @default(uuid())
  channelId       String  @unique
  linksEnabled    Boolean @default(true)
  linksWhitelist  String[]
  capsEnabled     Boolean @default(false)
  capsPercent     Int     @default(70)
  spamEnabled     Boolean @default(false)
  bannedWords     String[]
}
```

**Entregável:** streamer cria `!discord`, configura `!redes` com cooldown de 30s, ativa filtro de links — tudo pelo dashboard sem tocar em código.

---

## Fase 3 — Loyalty points e alertas em tela

> **Objetivo:** engajamento de longo prazo para viewers e impacto visual direto na live.

### Nest.js — Loyalty Module

- Earn rate: pontos por minuto assistido (configurável por canal)
- Bônus de pontos por evento: follow, sub, raid, kicks gifted
- Watch tracker: rastreia tempo de visualização por sessão de live
- Multiplicador de ganho para subscribers (ex: 1.5x)
- Comandos automáticos: `!pontos`, `!rank`, `!top`
- Dar pontos para outro viewer: `!dar [usuário] [quantidade]`
- Histórico de transações consultável pelo dashboard

### Nest.js — Alerts Gateway

- Gateway WebSocket no Nest.js usando `@WebSocketGateway`
- Eventos emitidos em tempo real: `follow`, `subscription`, `raid`, `tip`, `kicks`
- Fila de alertas com delay configurável para não sobrepor
- Broadcast para todos os overlays conectados ao canal
- Endpoint de teste de alerta via dashboard (sem precisar de evento real)

### Next.js — Overlay (browser source OBS)

- Rota pública sem autenticação: `/overlay/[token]`
- Token UUID único por canal gerado pelo backend
- Layout configurável: posição na tela, tamanho, fonte
- Animações de entrada e saída configuráveis por CSS
- Suporte a imagem e GIF customizado por tipo de alerta
- TTS nativo do browser opcional para ler a mensagem do alerta
- Conexão Socket.io que reconecta automaticamente se o OBS recarregar

### Next.js — Dashboard de Alertas

- Geração e cópia do link de overlay com um clique
- Configuração visual de cada tipo de alerta
- Preview ao vivo do alerta dentro do dashboard
- Botão de teste por tipo de evento

### Schema adicional

```prisma
model ViewerPoints {
  id        String @id @default(uuid())
  channelId String
  userId    String
  balance   Int    @default(0)
  @@unique([channelId, userId])
}

model PointTransaction {
  id        String   @id @default(uuid())
  channelId String
  userId    String
  amount    Int
  type      String
  createdAt DateTime @default(now())
}

model AlertConfig {
  id           String  @id @default(uuid())
  channelId    String
  type         String
  isActive     Boolean @default(true)
  imageUrl     String?
  message      String?
  durationMs   Int     @default(5000)
}

model WatchSession {
  id           String   @id @default(uuid())
  channelId    String
  userId       String
  startedAt    DateTime
  endedAt      DateTime?
  pointsEarned Int      @default(0)
}
```

**Entregável:** viewer assiste 30 minutos, acumula pontos, usa `!rank` para ver posição, streamer vê alerta de novo follow na tela com overlay configurado no OBS.

---

## Fase 4 — Giveaways, polls e ranking público

> **Objetivo:** ferramentas que movimentam o chat durante a live e criam momentos de engajamento coletivo.

### Nest.js — Giveaway Module

- Criação via dashboard ou comando `!sorteio [prêmio]`
- Entrada: `!entrar` com custo opcional em pontos de loyalty
- Filtros de participação: apenas followers, apenas subscribers, ambos, todos
- Sorteio automático ao fim do tempo ou manual pelo streamer
- Anúncio do vencedor no chat com mensagem customizável
- Reroll: novo sorteio entre os participantes (caso vencedor não responda)
- Histórico de sorteios com lista de participantes

### Nest.js — Polls Module

- Votação por comandos: `!votar 1`, `!votar 2`, `!votar 3`
- Duração configurável com countdown ativo no overlay
- Resultado em tempo real publicado via WebSocket para o overlay
- Votação com peso por pontos: subs votam com mais peso (opcional)
- Encerramento automático ao fim do tempo com anúncio do resultado
- Um voto por viewer por poll

### Next.js — Ranking público

- Rota pública: `/ranking/[canal]`
- Top viewers por pontos acumulados, tempo assistido, sub streak
- Badges visuais por conquistas: `Veterano`, `Fiel`, `Top Donor`
- Filtro por período: semana, mês, total histórico
- Atualização em tempo real via Server-Sent Events (SSE)
- Compartilhável como link externo (divulgação pelo streamer)

### Next.js — Dashboard Live Controls

- Painel de controle rápido para uso ao vivo durante a transmissão
- Iniciar poll ou sorteio com um clique sem sair da tela
- Feed do chat integrado com destaque de eventos importantes
- Contador de viewers e lista de eventos recentes (follows, subs)
- Ações de moderação rápidas: timeout e ban direto do painel

### Next.js — Games Module (extensão)

- O jogo da velha atual migra para `GamesModule` no backend
- Suporte a apostar pontos de loyalty na partida
- Resultado publicado no overlay ao fim da partida
- Base extensível para futuros jogos viewer vs viewer

### Schema adicional

```prisma
model Giveaway {
  id           String    @id @default(uuid())
  channelId    String
  prize        String
  filterType   String    @default("everyone")
  costPoints   Int       @default(0)
  status       String    @default("open")
  winnerId     String?
  createdAt    DateTime  @default(now())
  closedAt     DateTime?
}

model GiveawayEntry {
  id         String @id @default(uuid())
  giveawayId String
  userId     String
  @@unique([giveawayId, userId])
}

model Poll {
  id        String   @id @default(uuid())
  channelId String
  question  String
  options   String[]
  durationS Int      @default(60)
  status    String   @default("open")
  createdAt DateTime @default(now())
}

model PollVote {
  id       String @id @default(uuid())
  pollId   String
  userId   String
  option   Int
  @@unique([pollId, userId])
}
```

**Entregável:** streamer abre sorteio ao vivo pelo painel, viewers entram gastando pontos, ganhador é anunciado no chat e no overlay. Ranking público acessível por link externo.

---

## Fluxo de processamento de mensagem

```
Kick WebSocket
    │
    ▼
ChatEvent chega no Nest.js (KickService)
    │
    ├─► ModerationService     → valida / deleta / timeout
    │
    ├─► CommandParser         → detecta prefixo e trigger
    │       │
    │       └─► CommandHandler → executa lógica da feature
    │                │
    │                ├─► GiveawayService
    │                ├─► PollService
    │                ├─► LoyaltyService
    │                └─► GamesService
    │
    ├─► LoyaltyService        → registra pontos por mensagem
    │
    └─► AlertsGateway         → push para overlay (se evento relevante)
```

---

## Estimativas de esforço (dev solo)

| Fase | Escopo | Estimativa |
|------|--------|-----------|
| Fase 1 | Core do bot + auth + onboarding | 2 semanas |
| Fase 2 | Comandos + timers + moderação | 1,5 semana |
| Fase 3 | Loyalty points + overlay de alertas | 2 semanas |
| Fase 4 | Giveaway + polls + ranking + games | 1,5 semana |
| **Total** | | **~7 semanas** |

> As fases são cumulativas: cada uma depende da anterior. O jogo da velha já existente encaixa como módulo extra dentro da Fase 4 sem retrabalho.

---

## Próximos passos após Fase 4

Com a base completa, o diferencial competitivo entra em cena:

- **Viewer como personagem** — identidade persistente, evolução entre lives, conquistas visíveis no ranking
- **Decisões coletivas do chat** — ações que mudam o rumo da live em tempo real com resultado visível na tela
- **TTS com vozes AI** — viewer paga pontos para falar na live (integração com API de voz)
- **Clips automáticos** — bot detecta pico de mensagens no chat e cria clip automaticamente
- **Sistema de notificação de live** — bot avisa seguidores no chat quando streamer vai ao ar

---

*Documento gerado em junho de 2026 — atualizar conforme o projeto evolui.*