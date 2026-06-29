# Guia Rápido de Início

> **Frontend:** este repositório contém apenas o **backend** (bot + API). O dashboard web roda em um repositório/projeto separado que consome a API.

## Primeira Vez

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite `.env` e preencha:

```bash
# OAuth Kick.com (obrigatório)
KICK_CLIENT_ID=seu-client-id
KICK_CLIENT_SECRET=seu-client-secret
KICK_CHANNEL_SLUG=nome-do-canal
KICK_BOT_SLUG=nome-do-bot
KICK_CHATROOM_ID=123456

# API (opcional, tem padrões)
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
API_JWT_SECRET=sua-chave-secreta-aqui
WEB_PLAY_URL=http://localhost:3000/play
WEB_OVERLAY_URL=http://localhost:3000/overlay

# Senha do admin (desenvolvimento: "admin" sem hash)
# ADMIN_PASSWORD_HASH=
# Para gerar: node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('sua-senha', 10).then(console.log)"
```

No **projeto frontend** (repositório separado), configure a URL da API, por exemplo:

```bash
# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3001

# Vite (legado)
VITE_API_URL=http://localhost:3001
```

### 3. Subir infraestrutura (PostgreSQL + Redis)

```bash
npm run db:up
npm run prisma:generate
npm run prisma:migrate:dev
```

### 4. Compilar

```bash
npm run build
```

---

## Desenvolvimento

### Backend (bot + API)

```bash
npm run dev
```

Serviços disponíveis:

- **API REST:** http://localhost:3001
- **Swagger:** http://localhost:3001/api/docs
- **WebSocket (Socket.io):** mesma porta da API

### Frontend (projeto separado)

Em outro terminal, no diretório do frontend:

```bash
npm install
npm run dev
```

A URL do frontend deve coincidir com `CORS_ORIGIN` no `.env` do backend.

---

## Produção

### Build e start do backend

```bash
npm run build
npm start
```

Guia completo de deploy: [docs/DEPLOY-PRODUCAO.md](docs/DEPLOY-PRODUCAO.md)

---

## Testes

```bash
npm test
```

---

## Primeiro Login (via frontend)

1. Inicie o backend (`npm run dev`)
2. Inicie o frontend no projeto separado
3. Acesse a URL do frontend (ex: http://localhost:3000)
4. Login com senha `admin` (desenvolvimento, sem `ADMIN_PASSWORD_HASH`)
5. Em produção, configure `ADMIN_PASSWORD_HASH` no `.env` do backend

---

## Comandos Disponíveis

### Chat
- `!ttt join` — Jogo da velha
- `!ttt 1-9` — Fazer jogada
- `!ttt board` — Ver tabuleiro
- `!ttt forfeit` — Desistir
- `!rank` — Top 10
- `!rank me` — Seus pontos
- `!rank @usuario` — Pontos de alguém

### API (Swagger)
- Documentação interativa em `/api/docs`
- Autenticação: `POST /api/auth/login` → JWT no header `Authorization`

---

## Troubleshooting

**Bot não conecta ao chat:**
- Verifique `KICK_CHANNEL_SLUG` e `KICK_BOT_SLUG`
- Delete `.tokens.json` e refaça autenticação

**Frontend não loga / erro de CORS:**
- Verifique se `CORS_ORIGIN` no backend = URL exata do frontend (sem barra final)
- Confirme `NEXT_PUBLIC_API_URL` ou `VITE_API_URL` apontando para `http://localhost:3001`
- Em dev, senha é `admin` (sem hash)

**API retorna 401:**
- Token expirado (24h), faça login novamente no frontend

**Link `!ttt web` aponta para localhost em produção:**
- Defina `WEB_PLAY_URL` com a URL pública do frontend

---

## Documentação Completa

- [API REST](docs/API-DASHBOARD.md)
- [Deploy em produção](docs/DEPLOY-PRODUCAO.md)
- [Fase 3 (histórico)](docs/IMPLEMENTACAO-FASE-3.md)
- [Changelog](CHANGELOG.md)
