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
| OAuth scopes          | `user:read`, `channel:read`, `chat:write` — **falta** `events:subscribe` |
| Webhook handler       | **Não implementado**                                                     |
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

O scope `events:subscribe` exige **novo consentimento** OAuth.

### 4.1 Atualizar scopes no código

Em `src/auth/oauthFlow.ts`:

```typescript
scopes: [
  "user:read",
  "channel:read",
  "chat:write",
  "events:subscribe",
],
```

### 4.2 Remover token antigo

```bash
# Windows PowerShell
Remove-Item .tokens.json
```

### 4.3 Refazer OAuth

```bash
npm run dev
```

Autorize no browser — aceite a permissão de **eventos/webhooks**.

### 4.4 Confirmar

- [ ] `.tokens.json` recriado
- [ ] Bot inicia sem erro de autenticação

**Checkpoint Parte 4:** log `Autenticação OK` no terminal.

---

## Parte 5 — Inscrever no evento chat.message.sent

### 5.1 Obter access token

Use o token OAuth do bot (campo `access_token` em `.tokens.json` ou via fluxo interno `getValidToken()`).

### 5.2 Criar inscrição

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

**PowerShell:**

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

### 5.3 Listar inscrições ativas

```http
GET https://api.kick.com/public/v1/events/subscriptions
Authorization: Bearer SEU_ACCESS_TOKEN
```

**Checkpoint Parte 5:**

- [ ] POST retornou 200 com `subscription_id`
- [ ] GET lista `chat.message.sent`

---

## Parte 6 — Teste end-to-end

### Antes de testar

- [ ] Bot rodando (`npm run dev`)
- [ ] Tunnel ativo → `:3001`
- [ ] Webhook URL no portal = tunnel + `/api/kick/webhooks/events`
- [ ] Inscrição `chat.message.sent` ativa
- [ ] Endpoint webhook implementado (Parte 3)

### Disparar evento

1. Abra o chat do seu canal na Kick
2. Envie uma mensagem de teste
3. Verifique logs do backend

**Sucesso esperado:**

```
[WEBHOOK] chat.message.sent
  message_id: ...
  sender: usuario
  content: "teste"
```

**Checkpoint Parte 6:** mensagem no chat Kick → log no backend com payload completo.

> **Não avance para a Parte 7** até este checkpoint passar.

---

## Parte 7 — Relay Socket.io para o frontend

### Backend (a implementar)


| Componente              | Descrição                                 |
| ----------------------- | ----------------------------------------- |
| `src/api/chatEvents.ts` | Similar a `alertEvents.ts`                |
| Evento `join:chat`      | Cliente → servidor (JWT admin)            |
| Evento `chat:message`   | Servidor → cliente (mensagem normalizada) |
| Sala Socket.io          | `chat:{channelSlug}`                      |


### Modelo normalizado sugerido

```typescript
interface LiveChatMessage {
  id: string
  content: string
  createdAt: string
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

1. Conectar Socket.io em `NEXT_PUBLIC_API_URL`
2. Após login admin, emitir `join:chat`
3. Escutar `chat:message` e renderizar lista
4. Parser de emotes: `[emote:id:NOME]` → componente visual

**Checkpoint Parte 7:** mensagem no chat Kick → aparece na tela do dashboard em tempo real.

---

## Parte 8 — Enviar mensagem pelo dashboard

### API oficial (só no backend)

```http
POST https://api.kick.com/public/v1/chat
Authorization: Bearer TOKEN_OAUTH
Content-Type: application/json

{
  "broadcaster_user_id": 123456789,
  "content": "Olá chat!",
  "type": "user"
}
```

Scope necessário: `chat:write` (já configurado).

### Endpoint proxy (a implementar)

```http
POST /api/chat/send
Authorization: Bearer JWT_ADMIN
Content-Type: application/json

{ "content": "Olá chat!" }
```

Reutiliza lógica de `src/chat/chatSender.ts`.

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

