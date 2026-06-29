# Deploy em Produção — Guia Passo a Passo

Guia para colocar o **Kick Bot** (Fase 3) em ambiente de produção com **custo inicial zero**, permitindo testes reais do dashboard, API REST, WebSocket e interface de jogo (`/play`).

---

## Sumário

1. [Visão geral da arquitetura](#visão-geral-da-arquitetura)
2. [Por que não usar só Vercel](#por-que-não-usar-só-vercel)
3. [Pré-requisitos](#pré-requisitos)
4. [Fase 1 — Teste rápido (PC + Tunnel)](#fase-1--teste-rápido-pc--tunnel)
5. [Fase 2 — Produção estável (Oracle Cloud Free)](#fase-2--produção-estável-oracle-cloud-free)
6. [Deploy do frontend (Cloudflare Pages ou Vercel)](#deploy-do-frontend-cloudflare-pages-ou-vercel)
7. [Variáveis de ambiente em produção](#variáveis-de-ambiente-em-produção)
8. [OAuth Kick — autenticação inicial](#oauth-kick--autenticação-inicial)
9. [Checklist de validação](#checklist-de-validação)
10. [Troubleshooting](#troubleshooting)
11. [Provedores a evitar nesta fase](#provedores-a-evitar-nesta-fase)

---

## Visão geral da arquitetura

O projeto possui **dois componentes** em **repositórios separados**:

```
┌─────────────────────────┐
│  Frontend (separado)    │  Cloudflare Pages / Vercel / Netlify
│  Next.js ou Vite        │  Custo: $0
└───────────┬─────────────┘
            │  NEXT_PUBLIC_API_URL / VITE_API_URL (HTTPS)
            ▼
┌─────────────────────────┐
│  Bot + API + WebSocket  │  VM (Oracle Cloud) ou PC + Tunnel
│  npm start → porta 3001 │  Custo: $0
│  PostgreSQL + Redis     │
└───────────┬─────────────┘
            │  outbound
            ▼
      Kick.com (chat OAuth)
```

| Componente | Tecnologia | Onde hospedar |
|---|---|---|
| Bot + chat Kick | Node.js 20+, processo 24/7 | VM ou PC com tunnel |
| API REST + Socket.io | Express, porta 3001 | Mesmo servidor do bot |
| Banco de dados | PostgreSQL (Prisma) | Disco persistente no servidor |
| Dashboard + Play web | Next.js / React (repo separado) | Cloudflare Pages ou Vercel |

---

## Por que não usar só Vercel

A Vercel (e similares serverless) são excelentes para o **frontend**, mas **não suportam** o backend deste projeto:

| Requisito | Serverless (Vercel) | VM / PC |
|---|---|---|
| Processo contínuo (bot no chat) | ❌ | ✅ |
| WebSocket Socket.io persistente | ❌ | ✅ |
| SQLite com `better-sqlite3` | ❌ | ✅ |
| Arquivo `.tokens.json` persistente | ❌ | ✅ |
| Frontend React estático | ✅ | ✅ (opcional) |

**Estratégia correta:** frontend na Vercel/Pages + backend em VM gratuita ou tunnel.

---

## Pré-requisitos

Antes de iniciar o deploy:

- [ ] Bot funcionando localmente (`npm run dev`)
- [ ] Frontend funcionando localmente (projeto separado, apontando para a API)
- [ ] OAuth Kick concluído (arquivo `.tokens.json` gerado)
- [ ] Build de produção do backend sem erros:
  ```bash
  npm run build
  ```
- [ ] Conta no [Kick Developer Portal](https://kick.com/settings/developer) configurada
- [ ] Senha de admin definida (hash bcrypt — ver seção de variáveis)

---

## Fase 1 — Teste rápido (PC + Tunnel)

Use esta fase para **validar produção hoje**, sem configurar servidor na nuvem. Ideal para testar CORS, login JWT, dashboard e links `!ttt web`.

### 1.1 — Preparar o build de produção

Na raiz do projeto **backend**:

```bash
npm install
npm run build
```

### 1.2 — Configurar variáveis do bot

Edite o `.env` na raiz:

```bash
# Kick (já preenchido)
KICK_CLIENT_ID=...
KICK_CLIENT_SECRET=...
KICK_CHANNEL_SLUG=...
KICK_BOT_SLUG=...
KICK_CHATROOM_ID=...

# API — ajuste CORS_ORIGIN após obter URL do frontend (passo 1.4)
API_PORT=3001
CORS_ORIGIN=https://seu-projeto.pages.dev
API_JWT_SECRET=gere-uma-chave-aleatoria-longa-aqui
ADMIN_PASSWORD_HASH=$2a$10$...   # ver seção "Gerar hash de senha"
WEB_PLAY_URL=https://seu-projeto.pages.dev/play
DATABASE_PATH=data/bot.db
```

Gerar hash de senha:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('sua-senha-segura', 10).then(console.log)"
```

Gerar JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1.3 — Instalar e executar Cloudflare Tunnel

1. Baixe o `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Inicie o bot em produção:

```bash
npm start
```

3. Em outro terminal, exponha a API:

```bash
cloudflared tunnel --url http://localhost:3001
```

Anote a URL gerada (ex: `https://abc123.trycloudflare.com`). Essa URL muda a cada execução no modo gratuito rápido.

> **Dica:** Para URL fixa, crie uma conta Cloudflare gratuita e configure um [Named Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/).

### 1.4 — Deploy do frontend

Siga a seção [Deploy do frontend](#deploy-do-frontend-cloudflare-pages-ou-vercel) abaixo.

Configure a variável de build no **repositório frontend**:

```bash
# Next.js
NEXT_PUBLIC_API_URL=https://abc123.trycloudflare.com

# Vite
VITE_API_URL=https://abc123.trycloudflare.com
```

### 1.5 — Atualizar CORS e WEB_PLAY_URL

Após obter a URL final do frontend, atualize no `.env` do bot:

```bash
CORS_ORIGIN=https://seu-projeto.pages.dev
WEB_PLAY_URL=https://seu-projeto.pages.dev/play
```

Reinicie o bot (`npm start`).

### 1.6 — Limitações desta fase

- O PC precisa permanecer ligado
- URL do tunnel muda (modo trycloudflare) — atualize a URL da API no frontend e refaça deploy se mudar
- Não é adequado para live contínua — use a Fase 2 para isso

---

## Fase 2 — Produção estável (Oracle Cloud Free)

Para bot **24/7** sem depender do seu PC.

### 2.1 — Criar a VM

1. Acesse [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
2. Crie uma instância **Always Free**:
   - Shape: `VM.Standard.A1.Flex` (ARM) — até 4 OCPUs / 24 GB RAM
   - OS: **Ubuntu 22.04** ou **24.04**
   - Adicione chave SSH pública
3. Abra a porta **3001** (ou 80/443 se usar proxy) no Security List / firewall da instância

### 2.2 — Configurar o servidor

Conecte via SSH:

```bash
ssh ubuntu@<IP-DA-VM>
```

Instale dependências:

```bash
# Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# PM2 (gerenciador de processos)
npm install -g pm2

# Build tools para better-sqlite3
sudo apt update
sudo apt install -y build-essential python3 git
```

### 2.3 — Clonar e compilar o projeto

```bash
git clone https://github.com/<seu-usuario>/bot_kick.git
cd bot_kick
npm install
npm run build
```

### 2.4 — Copiar arquivos sensíveis da máquina local

Transfira da sua máquina de desenvolvimento para a VM:

| Arquivo | Destino na VM | Descrição |
|---|---|---|
| `.env` | `bot_kick/.env` | Variáveis de ambiente |
| `.tokens.json` | `bot_kick/.tokens.json` | Tokens OAuth Kick |
| `data/bot.db` | `bot_kick/data/bot.db` | Banco SQLite (opcional, se já tiver dados) |

Exemplo com `scp` (execute na sua máquina local):

```bash
scp .env .tokens.json ubuntu@<IP-DA-VM>:~/bot_kick/
scp -r data ubuntu@<IP-DA-VM>:~/bot_kick/
```

> **Importante:** Nunca commite `.env`, `.tokens.json` ou `data/bot.db` no Git.

### 2.5 — Configurar `.env` para produção na VM

```bash
API_PORT=3001
CORS_ORIGIN=https://seu-projeto.pages.dev
API_JWT_SECRET=<chave-forte>
ADMIN_PASSWORD_HASH=<hash-bcrypt>
WEB_PLAY_URL=https://seu-projeto.pages.dev/play
DATABASE_PATH=data/bot.db
```

### 2.6 — Iniciar com PM2

```bash
cd ~/bot_kick
pm2 start dist/bot.js --name kick-bot
pm2 save
pm2 startup   # siga as instruções exibidas para auto-start no boot
```

Comandos úteis:

```bash
pm2 status          # ver status
pm2 logs kick-bot   # ver logs
pm2 restart kick-bot
pm2 stop kick-bot
```

### 2.7 — HTTPS com Caddy (recomendado, com domínio)

Se você tiver um domínio apontando para o IP da VM:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Crie `/etc/caddy/Caddyfile`:

```
api.seudominio.com {
    reverse_proxy localhost:3001
}
```

```bash
sudo systemctl reload caddy
```

Atualize a URL da API no frontend (ex: `NEXT_PUBLIC_API_URL=https://api.seudominio.com`).

**Sem domínio:** use Cloudflare Tunnel na VM (mesmo procedimento da Fase 1, mas com Named Tunnel para URL fixa).

### 2.8 — Alternativa: Nginx como proxy reverso

```nginx
server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Use Certbot para HTTPS: `sudo certbot --nginx -d api.seudominio.com`

---

## Deploy do frontend (repositório separado)

O frontend **não está** neste repositório. Faça deploy a partir do projeto frontend (Next.js, Vite, etc.) conectado ao GitHub.

### Opção A — Cloudflare Pages

1. Crie um repositório só para o frontend e faça push
2. Acesse [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create**
3. Conecte o repositório do frontend
4. Configurações de build (exemplo Next.js):

| Campo | Valor |
|---|---|
| Framework preset | Next.js |
| Build command | `npm run build` |
| Build output directory | `.next` ou conforme o framework |

5. Variáveis de ambiente:

```bash
NEXT_PUBLIC_API_URL=https://api.seudominio.com
```

6. Deploy → anote a URL (ex: `https://kick-bot.pages.dev`)

### Opção B — Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o **repositório do frontend** (não o backend)
3. Configure build conforme o framework (Next.js detecta automaticamente)
4. **Environment Variable** (Production):

```bash
NEXT_PUBLIC_API_URL=https://sua-api-publica.com
```

> **Crítico:** variáveis `NEXT_PUBLIC_*` / `VITE_*` são compiladas no build. Sem elas, o frontend tenta `http://localhost:3001` e falha em produção.

5. Deploy

6. Para SPA/Vite, configure rewrites no `vercel.json` do **frontend** para rotas como `/play`, `/login` e `/overlay`.

#### Vercel + bot local (Cloudflare Tunnel)

Quando o bot roda no seu PC e a API é exposta via tunnel:

| Onde | Variável | Valor |
|---|---|---|
| Vercel (frontend) | `NEXT_PUBLIC_API_URL` | URL HTTPS do tunnel (ex: `https://xxx.trycloudflare.com`) |
| Bot (`.env`) | `CORS_ORIGIN` | URL do frontend Vercel (ex: `https://bot-kick.vercel.app`) |
| Bot (`.env`) | `WEB_PLAY_URL` | `https://bot-kick.vercel.app/play` |
| Bot (`.env`) | `WEB_OVERLAY_URL` | `https://bot-kick.vercel.app/overlay` |

Após alterar a URL da API no frontend, **refaça o deploy**. Após alterar o `.env` do bot, **reinicie** (`npm start` ou `pm2 restart`).

> URLs `*.trycloudflare.com` mudam a cada execução do tunnel. Atualize a URL da API no frontend e redeploy sempre que reiniciar o tunnel, ou use um [Named Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/) com URL fixa.

### Após o deploy do frontend

1. Copie a URL final do frontend
2. Atualize no `.env` do bot:
   ```bash
   CORS_ORIGIN=https://sua-url-do-frontend
   WEB_PLAY_URL=https://sua-url-do-frontend/play
   WEB_OVERLAY_URL=https://sua-url-do-frontend/overlay
   ```
3. Reinicie o bot (`pm2 restart kick-bot` ou `npm start`)

---

## Variáveis de ambiente em produção

### Bot (`.env` na raiz)

| Variável | Obrigatório | Descrição |
|---|---|---|
| `KICK_CLIENT_ID` | Sim | Client ID do app Kick |
| `KICK_CLIENT_SECRET` | Sim | Client Secret |
| `KICK_CHANNEL_SLUG` | Sim | Slug do canal |
| `KICK_BOT_SLUG` | Sim | Slug da conta do bot |
| `KICK_CHATROOM_ID` | Recomendado | ID numérico do chatroom |
| `API_PORT` | Não | Padrão: `3001` |
| `CORS_ORIGIN` | Sim (prod) | URL exata do frontend (sem barra final) |
| `API_JWT_SECRET` | Sim (prod) | Chave secreta forte para JWT |
| `ADMIN_PASSWORD_HASH` | Sim (prod) | Hash bcrypt da senha admin |
| `WEB_PLAY_URL` | Sim (prod) | URL base da página `/play` para links no chat |
| `WEB_OVERLAY_URL` | Sim (prod) | URL base de `/overlay` para Browser Source OBS |
| `DATABASE_URL` | Sim | PostgreSQL (Prisma) |
| `PLAYER_TOKEN_EXPIRY` | Não | Padrão: `10m` |

### Frontend (variáveis no painel do provedor — repo separado)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL HTTPS da API — Next.js (sem barra final) |
| `VITE_API_URL` | URL HTTPS da API — Vite (sem barra final) |

> **Atenção:** essas variáveis são embutidas no build. Sempre refaça o deploy do frontend ao alterá-las.

---

## OAuth Kick — autenticação inicial

O fluxo OAuth usa callback fixo em `http://localhost:3000/callback` (ver `src/auth/oauthFlow.ts`). Por isso, a autenticação inicial **deve ser feita na máquina local**:

### Procedimento

1. Na sua máquina de desenvolvimento:
   ```bash
   npm run dev
   ```
2. Autorize o app no browser quando solicitado
3. Confirme que `.tokens.json` foi criado na raiz do projeto
4. Copie `.tokens.json` para o servidor de produção (Fase 2, passo 2.4)

### Redirect URI no Kick Developer Portal

Mantenha configurado:

```
http://localhost:3000/callback
```

Para reautenticar no futuro, repita o fluxo localmente e copie o novo `.tokens.json` para o servidor.

> **Melhoria futura:** tornar `CALLBACK_PORT` e redirect URI configuráveis via `.env` para OAuth direto no servidor.

---

## Checklist de validação

Após o deploy, valide cada item:

### API

```bash
# Health check (sem auth)
curl https://sua-api.com/api/health

# Login
curl -X POST https://sua-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"sua-senha"}'

# Status (substitua TOKEN)
curl https://sua-api.com/api/status \
  -H "Authorization: Bearer TOKEN"
```

### Dashboard

- [ ] Acessar URL do frontend
- [ ] Login com senha de produção
- [ ] Dashboard exibe status, uptime e contadores
- [ ] Página de jogos carrega histórico
- [ ] Página de ranking carrega dados
- [ ] Logout funciona

### Bot no chat

- [ ] Bot responde a `!ping`
- [ ] `!ttt join` cria partida
- [ ] `!ttt web` gera link que abre `/play?token=...`
- [ ] Jogada via web sincroniza com o chat

### WebSocket

- [ ] Console do browser não exibe erros de conexão Socket.io
- [ ] Eventos em tempo real funcionam (quando implementados)

---

## Troubleshooting

### Erro 404 ao abrir link do `!ttt web` (Vercel)

O frontend **não acessa o banco SQLite diretamente**. O fluxo é:

```
Navegador (Vercel)  →  API do bot (tunnel/VM)  →  SQLite + partida em memória
     /play?token=         GET /api/play/session
```

Um **404 da Vercel** ocorre quando a rota `/play` não está configurada no projeto frontend. Solução: configure rewrites no `vercel.json` do **repositório frontend** e faça redeploy.

Um **erro na página** ("Sessão expirada ou partida encerrada") indica que o frontend carregou, mas a API falhou. Verifique:

1. `NEXT_PUBLIC_API_URL` ou `VITE_API_URL` configurada no provedor do frontend
2. Tunnel/API acessível: `curl https://sua-api/api/health`
3. Bot rodando (`npm start`) com tunnel ativo
4. `CORS_ORIGIN` no bot = URL exata da Vercel
5. Token não expirou (padrão: 10 min) — use `!ttt web` de novo

### Dashboard não carrega dados / erro de CORS

- Verifique se `CORS_ORIGIN` no bot corresponde **exatamente** à URL do frontend (protocolo + domínio, sem `/` no final)
- Reinicie o bot após alterar `.env`

### Login retorna 401

- Confirme `ADMIN_PASSWORD_HASH` no `.env`
- Em dev sem hash, a senha padrão é `admin` — em produção, **sempre** use hash

### API inacessível externamente

- Verifique firewall da VM (porta 3001 ou 443 aberta)
- Confirme que o bot está rodando: `pm2 status` ou logs
- Teste localmente na VM: `curl http://localhost:3001/api/health`

### Bot não conecta ao chat

- Verifique `KICK_CHANNEL_SLUG`, `KICK_BOT_SLUG` e `KICK_CHATROOM_ID`
- Confirme que `.tokens.json` existe no servidor
- Se tokens expiraram irreversivelmente, refaça OAuth localmente e copie o arquivo

### Link `!ttt web` aponta para localhost

- Defina `WEB_PLAY_URL` com a URL pública do frontend
- Reinicie o bot

### URL da API não atualiza no frontend

- Variáveis `NEXT_PUBLIC_*` / `VITE_*` são compiladas no build — **refaça o deploy** do frontend após alterar

### Erro ao compilar `better-sqlite3` na VM

```bash
sudo apt install -y build-essential python3
npm rebuild better-sqlite3
```

---

## Provedores a evitar nesta fase

| Provedor | Motivo |
|---|---|
| **Render (free tier)** | Serviço dorme após inatividade — bot desconecta do chat |
| **Railway (crédito limitado)** | Crédito mensal acaba rápido com processo 24/7 |
| **Vercel (para o bot)** | Serverless — não suporta processo persistente nem SQLite |
| **Heroku free** | Tier gratuito descontinuado |

---

## Resumo da estratégia recomendada

| Etapa | Quando | O quê | Custo |
|---|---|---|---|
| **Fase 1** | Agora (testes) | PC + Cloudflare Tunnel + frontend no Pages/Vercel | $0 |
| **Fase 2** | Antes da live | Oracle Cloud VM + PM2 + frontend no Pages/Vercel | $0 |
| **Opcional** | Quando quiser | Domínio próprio + Caddy/Nginx com HTTPS | ~R$ 40/ano |

---

## Documentação relacionada

- [API e Dashboard](API-DASHBOARD.md) — endpoints, autenticação e WebSocket
- [Implementação Fase 3](IMPLEMENTACAO-FASE-3.md) — status do projeto e pendências
- [Guia rápido](../START.md) — instalação e desenvolvimento local
