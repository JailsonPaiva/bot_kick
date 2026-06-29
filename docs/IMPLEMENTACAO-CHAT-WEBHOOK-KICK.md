# Implementação — Chat ao vivo via Webhook oficial Kick

> Guia passo a passo para receber mensagens do chat em tempo real usando a **Events API** da Kick (`chat.message.sent`), validar webhooks no backend e repassar ao frontend via Socket.io.

**Documentação oficial:** [docs.kick.com](https://docs.kick.com/)

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Estado atual do projeto](#estado-atual-do-projeto)
3. [Parte 0 — Pré-requisitos](#parte-0--pré-requisitos)
4. [Parte 1 — Developer Portal da Kick](#parte-1--developer-portal-da-kick)
5. [Parte 2 — Expor backend na internet (tunnel)](#parte-2--expor-backend-na-internet-tunnel)
6. [Parte 3 — Endpoint de webhook no backend](#parte-3--endpoint-de-webhook-no-backend)
7. [Parte 4 — Reautenticar OAuth](#parte-4--reautenticar-oauth)
8. [Parte 5 — Inscrever no evento chat.message.sent](#parte-5--inscrever-no-evento-chatmessagesent)
9. [Parte 6 — Teste end-to-end](#parte-6--teste-end-to-end)
10. [Parte 7 — Relay Socket.io para o frontend](#parte-7--relay-socketio-para-o-frontend)
11. [Parte 8 — Enviar mensagem pelo dashboard](#parte-8--enviar-mensagem-pelo-dashboard)
12. [Parte 9 — Moderação (opcional)](#parte-9--moderação-opcional)
13. [Variáveis de ambiente](#variáveis-de-ambiente)
14. [Troubleshooting](#troubleshooting)
15. [Ordem de execução](#ordem-de-execução)

---

## Visão geral

### Fluxo final

```
Viewer envia mensagem no chat Kick
        │
        ▼
Kick dispara webhook POST → https://sua-api/api/kick/webhooks/events
        │
        ▼
Backend valida assinatura (Kick-Event-Signature)
        │
        ▼
Backend emite Socket.io chat:message → Frontend (JWT admin)
        │
        ▼ (futuro)
Frontend POST /api/chat/send → Backend → POST /public/v1/chat (Kick)
```

### Por que webhook oficial (e não Pusher direto no browser)?


| Abordagem                           | Status na Kick                | Uso recomendado                  |
| ----------------------------------- | ----------------------------- | -------------------------------- |
| **Webhook** `chat.message.sent`     | API oficial                   | Dashboard, moderação, auditoria  |
| **Pusher WebSocket** (`WsListener`) | Não documentado na Public API | Bot interno (já usado hoje)      |
| **POST** `/public/v1/chat`          | API oficial                   | Enviar mensagens (só no backend) |


Este guia implementa **leitura oficial via webhook**. O bot pode continuar usando Pusher para comandos até migrarmos completamente.

---

## Estado atual do projeto


| Item                  | Situação                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| OAuth scopes (código) | `events:subscribe` em `src/auth/oauthScopes.ts` — **relogin manual**     |
| Webhook handler       | `POST /api/kick/webhooks/events` (Parte 3)                               |
| Reautenticação OAuth  | `npm run auth:relogin` (Parte 4)                                         |
| Inscrição webhook chat | `npm run kick:subscribe-chat` (Parte 5)                                  |
| Teste E2E webhook      | `npm run kick:webhook-check` (Parte 6)                                   |
| Relay Socket.io chat   | `join:chat` / `chat:message` (Parte 7)                                   |
| Envio chat dashboard   | `POST /api/chat/send` (Parte 8)                                          |
| Leitura de chat (bot) | `src/chat/wsListener.ts` (Pusher)                                        |
| Envio de mensagem     | `src/chat/chatSender.ts` → `POST /public/v1/chat`                        |
| Frontend              | Repositório separado — consome API + Socket.io                           |


---

## Parte 0 — Pré-requisitos

### Checklist

- [x] Bot rodando: `npm run dev`
- [x] `.tokens.json` válido (OAuth concluído)
- [x] `.env` com `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`, `KICK_CHANNEL_SLUG`
- [x] Acesso ao [Developer Portal](https://kick.com/settings/developer)
- [x] API local respondendo: `http://localhost:3001/api/docs`

### Requisitos da Kick para webhooks

1. URL **pública HTTPS** (localhost não funciona)
2. Scope `events:subscribe` no OAuth
3. Webhook **habilitado** no app + URL no portal
4. Inscrição via `POST /public/v1/events/subscriptions`

### Limites de assinatura


| Tipo de app    | Limite `chat.message.sent` |
| -------------- | -------------------------- |
| Não verificado | 1.000                      |
| Verificado     | 10.000                     |


Para um único canal, o limite não verificado é suficiente.

**Checkpoint:** `curl http://localhost:3001/api/health` retorna sucesso.

---

## Parte 1 — Developer Portal da Kick

### 1.1 Abrir o app

1. Acesse [kick.com/settings/developer](https://kick.com/settings/developer)
2. Selecione seu app (ou crie um novo)
3. Clique em **Edit** / **Editar**

### 1.2 Redirect URL (OAuth)

Confirme:

```
http://localhost:3000/callback
```

Deve ser idêntico ao configurado em `src/auth/oauthFlow.ts`.

### 1.3 Scopes (permissões)

Marque no app:


| Scope              | Obrigatório    | Uso                       |
| ------------------ | -------------- | ------------------------- |
| `user:read`        | Sim            | Identificar usuário OAuth |
| `channel:read`     | Sim            | Dados do canal            |
| `chat:write`       | Sim            | Bot enviar mensagens      |
| `events:subscribe` | **Sim (novo)** | Receber webhooks          |


Opcional (Parte 9 — moderação):


| Scope                            | Uso             |
| -------------------------------- | --------------- |
| `moderation:ban`                 | Ban/timeout     |
| `moderation:chat_message:manage` | Apagar mensagem |


Salve o app.

### 1.4 Habilitar Webhooks

Na seção **Enable Webhooks**:

1. Ative o switch (**On**)
2. **Webhook URL** — preencher na [Parte 2](#parte-2--expor-backend-na-internet-tunnel) após criar o tunnel

> A Kick envia POST para essa URL. Deve ser HTTPS e acessível publicamente.

**Checkpoint Parte 1:**

- [ ] Scopes incluem `events:subscribe`
- [ ] Redirect URI = `http://localhost:3000/callback`
- [ ] Webhooks = **On**

---

## Parte 2 — Expor backend na internet (tunnel)

Webhooks não alcançam `localhost`. Em desenvolvimento, use **Cloudflare Tunnel**.

### 2.1 Instalar cloudflared

Download: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

### 2.2 Subir o bot

```bash
npm run dev
```

API em `http://localhost:3001`.

### 2.3 Abrir tunnel (terminal separado)

```bash
cloudflared tunnel --url http://localhost:3001
```

Anote a URL, ex.:

```
https://abc123-random.trycloudflare.com
```

### 2.4 URL do webhook

Rota que o backend expõe:

```
https://abc123-random.trycloudflare.com/api/kick/webhooks/events
```

### 2.5 Configurar no Developer Portal

1. [kick.com/settings/developer](https://kick.com/settings/developer) → **Edit**
2. **Webhook URL** = URL acima (com path completo)
3. Salvar

### 2.6 Variáveis no `.env`

```env
PUBLIC_API_URL=https://abc123-random.trycloudflare.com
KICK_WEBHOOK_PATH=/api/kick/webhooks/events
```

> **Atenção:** URLs `*.trycloudflare.com` mudam a cada reinício do tunnel. Atualize portal + `.env` sempre que reiniciar.

**Checkpoint Parte 2:**

```bash
curl https://SUA-URL.trycloudflare.com/api/health
```

Deve retornar JSON de sucesso.

---

## Parte 3 — Endpoint de webhook no backend

> **Status:** implementado em `POST /api/kick/webhooks/events`

### Rotas e arquivos

| Item | Arquivo |
|------|---------|
| Rota webhook | `src/api/routes/kickWebhooks.ts` |
| Validação assinatura | `src/kick/webhookSignature.ts` |
| Public Key (cache) | `src/kick/webhookPublicKey.ts` |
| Handler de eventos | `src/kick/webhookHandler.ts` |
| Tipos payload | `src/kick/webhookTypes.ts` |

### Teste local (sem assinatura Kick)

Com o bot rodando, defina temporariamente no `.env`:

```env
KICK_WEBHOOK_SKIP_VERIFY=true
```

PowerShell:

```powershell
$body = '{"message_id":"test-local","content":"oi","created_at":"2025-01-14T16:08:06Z","broadcaster":{"user_id":1,"username":"bc"},"sender":{"user_id":2,"username":"viewer"}}'

Invoke-RestMethod `
  -Uri "http://localhost:3001/api/kick/webhooks/events" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Kick-Event-Message-Id" = "01ARZ3NDEKTSV4RRFFQ69G5FAV"
    "Kick-Event-Message-Timestamp" = "2025-01-14T16:08:06Z"
    "Kick-Event-Type" = "chat.message.sent"
    "Kick-Event-Version" = "1"
    "Kick-Event-Signature" = "dGVzdA=="
  } `
  -Body $body
```

Resposta esperada: `{ "success": true, "ok": true }` e log `[WEBHOOK] chat.message.sent`.

> **Produção:** remova `KICK_WEBHOOK_SKIP_VERIFY` ou defina `false` — a Kick exige assinatura válida.

### Headers enviados pela Kick


| Header                         | Exemplo             | Descrição                 |
| ------------------------------ | ------------------- | ------------------------- |
| `Kick-Event-Type`              | `chat.message.sent` | Tipo do evento            |
| `Kick-Event-Version`           | `1`                 | Versão do payload         |
| `Kick-Event-Signature`         | (Base64)            | Assinatura para validação |
| `Kick-Event-Message-Id`        | ULID                | ID único (idempotência)   |
| `Kick-Event-Message-Timestamp` | RFC3339             | Timestamp do envio        |
| `Kick-Event-Subscription-Id`   | ULID                | ID da assinatura          |


### Payload `chat.message.sent` (v1)

Campos principais (referência [Webhook Payloads](https://docs.kick.com/events/webhook-payloads)):

```json
{
  "message_id": "unique_message_id_123",
  "content": "Hello [emote:4148074:HYPERCLAP]",
  "created_at": "2025-01-14T16:08:06Z",
  "sender": {
    "user_id": 987654321,
    "username": "sender_name",
    "identity": {
      "username_color": "#FF5733",
      "badges": [{ "text": "Moderator", "type": "moderator" }]
    }
  },
  "broadcaster": { "user_id": 123456789, "channel_slug": "seu-canal" },
  "replies_to": null,
  "emotes": [{ "emote_id": "4148074", "positions": [{ "s": 6, "e": 30 }] }]
}
```

### Resposta esperada do endpoint

- **HTTP 200** em até ~5 segundos
- Se falhar repetidamente por >24h, a Kick **cancela a assinatura** automaticamente

**Checkpoint Parte 3:**

- [ ] Rota registrada no Express
- [ ] POST de teste retorna 200
- [ ] Logs mostram headers e body parseados

---

## Parte 4 — Reautenticar OAuth

> **Status:** implementado — scope `events:subscribe` + comando `npm run auth:relogin`

O scope `events:subscribe` exige **novo consentimento** OAuth. O token antigo (refresh) **não** ganha scopes novos automaticamente.

### 4.1 Scopes no código (já aplicado)

Arquivo `src/auth/oauthScopes.ts`:

```typescript
export const KICK_OAUTH_SCOPES = [
  "user:read",
  "channel:read",
  "chat:write",
  "events:subscribe",
];
```

### 4.2 Developer Portal — confirme antes do login

Em [kick.com/settings/developer](https://kick.com/settings/developer) → **Edit** no app:

- [ ] `events:subscribe` marcado
- [ ] Redirect URI = `http://localhost:3000/callback`
- [ ] Webhooks = **On** (Parte 1)

### 4.3 Refazer OAuth (comando automatizado)

**Pare o bot** (`Ctrl+C`) — a porta 3000 do callback OAuth não pode estar em uso por outro processo.

```powershell
npm run auth:relogin
```

O script:

1. Remove `.tokens.json`
2. Abre o browser para autorizar (aceite **todas** as permissões)
3. Valida via introspect se `events:subscribe` está no token
4. Exibe `Reautenticação OK` ou erro com scopes ausentes

### 4.4 Alternativa manual

```powershell
Remove-Item .tokens.json -ErrorAction SilentlyContinue
npm run auth:relogin
```

Ou delete `.tokens.json` e rode `npm run dev` (OAuth abre na primeira execução).

### 4.5 Checkpoint Parte 4

- [ ] Comando termina com `Reautenticação OK`
- [ ] Saída inclui `events:subscribe` nos scopes concedidos
- [ ] `.tokens.json` recriado
- [ ] `npm run dev` inicia com `Autenticação OK`

---

## Parte 5 — Inscrever no evento chat.message.sent

> **Status:** implementado — serviço `src/kick/eventSubscriptions.ts` + comando `npm run kick:subscribe-chat`

### 5.1 Pré-requisito

- Parte 4 concluída (`events:subscribe` no token — `npm run auth:relogin`)
- Webhook **On** no Developer Portal (Parte 1)
- URL pública HTTPS configurada no portal (Parte 2) — necessária para a Kick entregar eventos na Parte 6

### 5.2 Comando automatizado (recomendado)

```powershell
npm run kick:subscribe-chat
```

O script:

1. Lista inscrições ativas (`GET /public/v1/events/subscriptions`)
2. Se `chat.message.sent` v1 webhook já existir → reutiliza (`created: false`)
3. Senão → cria via `POST` e exibe `subscription_id`
4. Lista novamente para confirmar checkpoint

Saída esperada:

```
Inscrição criada com sucesso.
subscription_id: 01HZ8X9K2M4N6P8Q0R2S4T6V8W0Y2Z4
Ativa na Kick: event=chat.message.sent v1 method=webhook
Total de inscrições ativas: 1
```

### 5.3 API usada (referência manual)

```http
POST https://api.kick.com/public/v1/events/subscriptions
Authorization: Bearer SEU_ACCESS_TOKEN
Content-Type: application/json

{
  "events": [
    { "name": "chat.message.sent", "version": 1 }
  ],
  "method": "webhook"
}
```

Com **User Access Token**, `broadcaster_user_id` é inferido automaticamente (conta que fez OAuth).

**PowerShell (alternativa manual):**

```powershell
$token = "SEU_ACCESS_TOKEN"
$body = @{
  events = @(@{ name = "chat.message.sent"; version = 1 })
  method = "webhook"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://api.kick.com/public/v1/events/subscriptions" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
  -Body $body
```

Resposta esperada (200):

```json
{
  "data": [
    {
      "subscription_id": "...",
      "name": "chat.message.sent",
      "version": 1
    }
  ]
}
```

### 5.4 Listar inscrições ativas

```http
GET https://api.kick.com/public/v1/events/subscriptions
Authorization: Bearer SEU_ACCESS_TOKEN
```

**Checkpoint Parte 5:**

- [ ] `npm run kick:subscribe-chat` termina sem erro
- [ ] Saída inclui `subscription_id`
- [ ] GET (via script) lista `chat.message.sent` v1 method=webhook

---

## Parte 6 — Teste end-to-end

> **Status:** checklist automatizado — `npm run kick:webhook-check` + mensagem real no chat Kick

Objetivo: mensagem enviada no chat da live → Kick dispara webhook → backend loga `[WEBHOOK] chat.message.sent`.

### 6.1 Subir ambiente (3 terminais)

**Terminal 1 — bot:**

```powershell
npm run dev
```

Aguarde `Autenticação OK` e API em `:3001`.

**Terminal 2 — tunnel Cloudflare:**

```powershell
cloudflared tunnel --url http://localhost:3001
```

Anote a URL gerada (ex.: `https://abc123.trycloudflare.com`).

**Terminal 3 — checks e testes:**

Atualize `.env` se a URL do tunnel mudou:

```env
PUBLIC_API_URL=https://abc123.trycloudflare.com
KICK_WEBHOOK_PATH=/api/kick/webhooks/events
```

No [Developer Portal](https://kick.com/settings/developer) → **Webhook URL**:

```
https://abc123.trycloudflare.com/api/kick/webhooks/events
```

> URLs `*.trycloudflare.com` mudam a cada reinício do tunnel — atualize portal + `.env` sempre.

### 6.2 Checklist automatizado (pré-voo)

Com bot + tunnel rodando:

```powershell
npm run kick:webhook-check
```

O script valida:

| Check | O que verifica |
| ----- | -------------- |
| `PUBLIC_API_URL` | Variável definida no `.env` |
| `Webhook URL (portal Kick)` | URL completa para colar no portal |
| `Health via tunnel` | `GET /api/health` pela URL pública |
| `Health local (bot)` | Bot respondendo em `localhost:3001` |
| `Inscrição chat.message.sent` | Parte 5 ativa na Kick |
| `Probe webhook` | POST de teste via tunnel (se `KICK_WEBHOOK_SKIP_VERIFY=true`) |
| `Verificação de assinatura` | Lembrete dev vs produção |

Saída esperada (todos `[OK]`):

```
[OK] PUBLIC_API_URL: https://abc123.trycloudflare.com
[OK] Webhook URL (portal Kick): https://abc123.../api/kick/webhooks/events
[OK] Health via tunnel: ...
[OK] Probe webhook (tunnel → bot): POST retornou 200
[OK] Health local (bot): ...
[OK] Inscrição chat.message.sent: ativa — id=...
Checklist pré-voo OK — envie uma mensagem no chat Kick...
```

### 6.3 Disparar evento real

1. Abra o chat do canal (`KICK_CHANNEL_SLUG`) na Kick
2. Envie uma mensagem de teste (ex.: `teste webhook`)
3. Verifique o **Terminal 1** (bot)

**Sucesso esperado:**

```
[WEBHOOK] chat.message.sent v1 msgId=...
[WEBHOOK] chat.message.sent
  message_id: ...
  sender: seu_usuario
  content: "teste webhook"
```

### 6.4 Assinatura RSA (produção vs dev)

| Modo | `.env` | Comportamento |
| ---- | ------ | ------------- |
| Dev local / probe | `KICK_WEBHOOK_SKIP_VERIFY=true` | Aceita POST de teste manual; eventos reais também passam |
| Produção | `KICK_WEBHOOK_SKIP_VERIFY=false` (ou remova) | Valida assinatura Kick via public key — obrigatório em prod |

Para o teste **real** da Kick, a assinatura é válida nos dois modos. O probe automatizado só funciona com `SKIP_VERIFY=true`.

### 6.5 Troubleshooting rápido

| Sintoma | Causa provável | Ação |
| ------- | -------------- | ---- |
| Nenhum log após mensagem no chat | Webhook URL desatualizada no portal | Confira URL do tunnel atual |
| `401 Assinatura inválida` | `SKIP_VERIFY=false` + probe manual | Normal para probe; use mensagem real ou ative skip em dev |
| `Health via tunnel` falha | Tunnel parado ou URL errada | Reinicie `cloudflared` e atualize `.env` |
| Bot sem log | Bot não rodando | `npm run dev` no Terminal 1 |

**Checkpoint Parte 6:**

- [ ] `npm run kick:webhook-check` — todos `[OK]`
- [ ] Mensagem no chat Kick → log `[WEBHOOK] chat.message.sent` no terminal do bot
- [ ] Log inclui `message_id`, `sender` e `content`

> **Não avance para a Parte 7** até este checkpoint passar.

---

## Parte 7 — Relay Socket.io para o frontend

> **Status:** implementado no backend — `src/api/chatEvents.ts` + normalização em `src/kick/liveChatMessage.ts`

Fluxo: webhook `chat.message.sent` → normaliza payload → `broadcastChatMessage` → clientes na sala `chat:{channelSlug}`.

### Backend (implementado)

| Componente | Arquivo |
| ---------- | ------- |
| Normalização | `src/kick/liveChatMessage.ts` |
| Socket.io | `src/api/chatEvents.ts` |
| Integração webhook | `src/api/routes/kickWebhooks.ts` |

| Evento | Direção | Payload |
| ------ | ------- | ------- |
| `join:chat` | Cliente → Servidor | `{ token, channelSlug }` — JWT admin |
| `chat:joined` | Servidor → Cliente | `{ channelSlug }` |
| `chat:message` | Servidor → Cliente | `LiveChatMessage` + `timestamp` |
| `chat:error` | Servidor → Cliente | `{ error }` |

Sala Socket.io: `chat:{channelSlug}` (ex.: `chat:unao-da-firma`).

### Modelo `LiveChatMessage`

```typescript
interface LiveChatMessage {
  id: string
  content: string
  createdAt: string
  channelSlug: string
  sender: {
    userId: number
    username: string
    color?: string
    badges: Array<{ type: string; text: string; count?: number }>
    avatarUrl?: string
  }
  replyTo?: {
    messageId: string
    content: string
    username: string
  }
  emotes?: Array<{ emoteId: string; positions: Array<{ start: number; end: number }> }>
}
```

### Frontend (repositório separado)

1. Conectar Socket.io em `NEXT_PUBLIC_API_URL` (mesma porta da API, ex.: `:3001`)
2. Após login admin (`POST /api/auth/login`), emitir:

```typescript
socket.emit("join:chat", {
  token: adminJwt,
  channelSlug: "unao-da-firma", // KICK_CHANNEL_SLUG
});
```

3. Escutar confirmação e mensagens:

```typescript
socket.on("chat:joined", ({ channelSlug }) => { /* sala ok */ });
socket.on("chat:message", (message: LiveChatMessage) => { /* renderizar */ });
socket.on("chat:error", ({ error }) => { /* tratar erro */ });
```

4. Parser de emotes: `[emote:id:NOME]` → componente visual

### Teste manual (checkpoint Parte 7)

1. Bot rodando (`npm run dev`) + tunnel + webhook ativo (Partes 5–6)
2. Script Node ou frontend conectado com JWT admin + `join:chat`
3. Envie mensagem no chat Kick
4. Cliente recebe evento `chat:message` em tempo real

**Checkpoint Parte 7:** mensagem no chat Kick → evento `chat:message` no cliente Socket.io conectado.

---

## Parte 8 — Enviar mensagem pelo dashboard

> **Status:** implementado — `POST /api/chat/send` em `src/api/routes/chat.ts`

### Endpoint proxy

```http
POST /api/chat/send
Authorization: Bearer JWT_ADMIN
Content-Type: application/json

{
  "content": "Olá chat!",
  "channelSlug": "unao-da-firma"
}
```

| Campo | Obrigatório | Descrição |
| ----- | ----------- | --------- |
| `content` | Sim | Texto (1–500 chars, trim automático) |
| `channelSlug` | Não | Padrão: `KICK_CHANNEL_SLUG` do `.env` |

**Resposta 200:**

```json
{
  "success": true,
  "message": "Mensagem enviada",
  "data": {
    "broadcasterUserId": 123456,
    "channelSlug": "unao-da-firma"
  }
}
```

**Erros:**

| HTTP | Causa |
| ---- | ----- |
| 400 | `content` vazio ou > 500 caracteres |
| 401 | JWT admin ausente/inválido |
| 502 | Falha na API Kick (OAuth, rate limit, etc.) |

### Comportamento

- Usa `sendMessage()` de `src/chat/chatSender.ts` com **`useBotPrefix: false`** (sem `[BOT]`)
- Resolve `broadcaster_user_id` via API Kick (`fetchBroadcasterUserId` ou OAuth)
- Scope OAuth necessário no backend: `chat:write` (já configurado na Parte 4)

### Teste via Swagger ou curl

```powershell
# 1. Login
$login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"password":"admin"}'
$token = $login.data.token

# 2. Enviar
Invoke-RestMethod -Uri "http://localhost:3001/api/chat/send" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
  -Body '{"content":"teste dashboard"}'
```

### Frontend (repo separado)

```typescript
await fetch(`${API_URL}/api/chat/send`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${adminJwt}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ content: texto }),
});
```

A mensagem enviada também volta via webhook → `chat:message` no Socket.io (se Partes 5–7 ativas).

**Checkpoint Parte 8:** mensagem digitada no dashboard → aparece no chat da Kick.

---

## Parte 9 — Moderação (opcional)


| Ação            | API Kick                              | Scope                            |
| --------------- | ------------------------------------- | -------------------------------- |
| Apagar mensagem | `DELETE /public/v1/chat/{message_id}` | `moderation:chat_message:manage` |
| Ban / timeout   | `POST /public/v1/moderation/bans`     | `moderation:ban`                 |
| Remover ban     | `DELETE /public/v1/moderation/bans`   | `moderation:ban`                 |


Requer adicionar scopes no portal + refazer OAuth (Parte 4).

Endpoints proxy sugeridos no backend:

- `DELETE /api/chat/:messageId`
- `POST /api/chat/moderation/ban`

---

## Variáveis de ambiente

```env
# Existentes
KICK_CLIENT_ID=
KICK_CLIENT_SECRET=
KICK_CHANNEL_SLUG=
KICK_BOT_SLUG=
KICK_CHATROOM_ID=

# Chat webhook (novas)
PUBLIC_API_URL=https://xxx.trycloudflare.com
KICK_WEBHOOK_PATH=/api/kick/webhooks/events

# API / frontend
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
```

---

## Troubleshooting


| Problema                | Causa provável                 | Solução                              |
| ----------------------- | ------------------------------ | ------------------------------------ |
| Webhook não chega       | Tunnel parado ou URL errada    | Reinicie tunnel; atualize portal     |
| 401 ao inscrever evento | Token sem `events:subscribe`   | Refaça Parte 4                       |
| 403 ao inscrever        | Webhook desabilitado no portal | Parte 1.4                            |
| Assinatura inválida     | Validação incorreta            | Conferir Public Key e headers        |
| Kick cancela inscrição  | Endpoint retorna erro >24h     | Sempre responder 200 OK rápido       |
| URL tunnel mudou        | Modo trycloudflare             | Atualizar portal + `.env` + redeploy |


---

## Ordem de execução

```
Parte 0  →  Pré-requisitos
Parte 1  →  Developer Portal (scopes + webhooks ON)
Parte 2  →  Tunnel HTTPS
Parte 3  →  Código: endpoint webhook + validação assinatura
Parte 4  →  Re-OAuth com events:subscribe
Parte 5  →  POST /events/subscriptions
Parte 6  →  Teste: mensagem no chat → log no backend  ✓ GATE
Parte 7  →  Código: Socket.io chat:message + frontend
Parte 8  →  Código: POST /api/chat/send
Parte 9  →  Moderação (opcional)
```

---

## Referências

- [Events — Introduction](https://docs.kick.com/events/introduction)
- [Webhook Payloads](https://docs.kick.com/events/webhook-payloads)
- [Subscribe to Events](https://docs.kick.com/events/subscribe-to-events)
- [Webhook Security](https://docs.kick.com/events/webhook-security)
- [Chat API — Post Message](https://docs.kick.com/apis/chat)
- [Public Key](https://docs.kick.com/apis/public-key)
- Swagger local: `http://localhost:3001/api/docs`

---

## Documentação relacionada

- [API e Dashboard](API-DASHBOARD.md)
- [Deploy em produção](DEPLOY-PRODUCAO.md)
- [Guia rápido](../START.md)

