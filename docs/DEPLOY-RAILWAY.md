# 🚂 Deploy Railway - Kick Bot

Este guia detalha o processo completo de deploy no Railway.app.

## 📋 Pré-requisitos

- Conta no [Railway.app](https://railway.app)
- Railway CLI instalado (`npm i -g @railway/cli`)
- Credenciais do Kick Developer Portal
- Repositório Git configurado

## 🚀 Deploy Passo a Passo

### 1. Login no Railway

```bash
railway login
```

Isso abrirá o browser para autenticação.

### 2. Inicializar Projeto

```bash
railway init
```

Escolha:
- "Create a new project" 
- Dê um nome ao projeto (ex: `kick-bot-production`)

### 3. Adicionar PostgreSQL

```bash
railway add --plugin postgresql
```

Isso provisionará automaticamente um banco PostgreSQL e injetará `DATABASE_URL` nas variáveis de ambiente.

### 4. Adicionar Redis

```bash
railway add --plugin redis
```

Isso provisionará automaticamente Redis e injetará `REDIS_URL` nas variáveis de ambiente.

### 5. Configurar Variáveis de Ambiente

Copie o template `.env.railway` e configure as variáveis:

```bash
# Variáveis obrigatórias do Kick
railway variables set KICK_CLIENT_ID="seu_client_id"
railway variables set KICK_CLIENT_SECRET="seu_client_secret"
railway variables set KICK_CHANNEL_SLUG="seu_canal"
railway variables set KICK_BOT_SLUG="seu_bot"
railway variables set KICK_CHATROOM_ID="id_do_chat"

# API Configuration
railway variables set API_PORT="3001"
railway variables set API_JWT_SECRET="seu_jwt_secret_super_seguro"
railway variables set ADMIN_PASSWORD_HASH="seu_hash_bcrypt"

# CORS (ajuste para seu frontend)
railway variables set CORS_ORIGIN="https://seu-frontend.vercel.app"
```

Ou configure diretamente no dashboard Railway:
- Acesse: https://railway.app/dashboard
- Selecione seu projeto
- Vá em "Variables"
- Adicione as variáveis uma por uma

### 6. Fazer Deploy

```bash
railway up
```

O Railway irá:
1. Fazer build (`npm install && prisma generate && tsc`)
2. Rodar migrations (`prisma migrate deploy`)
3. Iniciar a aplicação (`npm start`)

### 7. Obter URL Pública

```bash
railway domain
```

Isso gerará uma URL pública (ex: `https://kick-bot-production.up.railway.app`).

**IMPORTANTE**: Copie esta URL e:
1. Configure como `PUBLIC_API_URL` no Railway:
   ```bash
   railway variables set PUBLIC_API_URL="https://kick-bot-production.up.railway.app"
   ```
2. Configure no Kick Developer Portal como Webhook URL:
   - URL: `https://kick-bot-production.up.railway.app/api/kick/webhooks/events`

### 8. Reautenticar OAuth

Após o primeiro deploy, você precisará reautenticar o bot:

```bash
railway run npm run auth:relogin
```

Ou via dashboard Railway:
- Acesse o terminal do serviço
- Execute: `npm run auth:relogin`

### 9. Registrar Webhook do Kick

```bash
railway run npm run kick:subscribe-chat
```

Isso registrará o webhook de chat events na Kick.

## 📊 Monitoramento

### Logs em Tempo Real

```bash
railway logs
```

### Metrics e Status

Acesse o dashboard Railway para ver:
- CPU/Memory usage
- Request metrics
- Database connections
- Logs históricos

## 🔄 Atualizações

Para deploy de novas versões:

```bash
git add .
git commit -m "feat: nova funcionalidade"
git push

# Deploy
railway up
```

## 💰 Custos Estimados

Railway cobra por uso:

- **Starter Plan** (recomendado):
  - $5/mês de crédito grátis
  - ~$0.000463/GB-hour
  - PostgreSQL + Redis inclusos
  
- **Estimativa mensal**:
  - Bot + API: ~$3-5
  - PostgreSQL: ~$2-3
  - Redis: ~$1-2
  - **Total**: $6-10/mês (primeira conta tem crédito grátis)

## 🔧 Troubleshooting

### Erro de conexão com banco

Verifique se `DATABASE_URL` está configurado:
```bash
railway variables
```

Se não estiver, adicione o plugin PostgreSQL novamente:
```bash
railway add --plugin postgresql
```

### Erro de autenticação Kick

Re-execute o fluxo OAuth:
```bash
railway run npm run auth:relogin
```

### WebSocket não conecta

1. Verifique se `KICK_CHATROOM_ID` está correto
2. Verifique logs: `railway logs`
3. Teste localmente primeiro: `npm run dev`

### Migrations não aplicadas

Execute manualmente:
```bash
railway run npx prisma migrate deploy
```

## 🎯 Próximos Passos

1. ✅ Deploy do backend no Railway
2. 🔜 Deploy do frontend (Vercel/Netlify)
3. 🔜 Configurar domínio customizado
4. 🔜 Configurar CI/CD com GitHub Actions

## 📚 Recursos

- [Railway Docs](https://docs.railway.app)
- [Railway CLI Reference](https://docs.railway.app/develop/cli)
- [Prisma + Railway](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-railway)

---

**Dúvidas?** Consulte os logs com `railway logs` ou o dashboard em https://railway.app/dashboard
