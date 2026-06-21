# Guia Rápido de Início

## Primeira Vez

### 1. Instalar Dependências

```bash
npm install
cd web
npm install
cd ..
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
KICK_REDIRECT_URI=http://localhost:3333/auth/callback
KICK_CHANNEL_SLUG=nome-do-canal
KICK_BOT_SLUG=nome-do-bot

# API e Dashboard (opcional, tem padrões)
API_PORT=3001
CORS_ORIGIN=http://localhost:5173
API_JWT_SECRET=sua-chave-secreta-aqui

# Senha do admin (desenvolvimento: "admin" sem hash)
# ADMIN_PASSWORD_HASH=
# Para gerar: node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('sua-senha', 10).then(console.log)"
```

No `web/.env`:

```bash
cp web/.env.example web/.env
```

```bash
VITE_API_URL=http://localhost:3001
```

### 3. Compilar

```bash
npm run build
```

---

## Desenvolvimento

### Opção A: Bot + Dashboard separados

**Terminal 1** (Bot + API):
```bash
npm run dev
```

**Terminal 2** (Dashboard):
```bash
npm run dev:web
```

Acesse:
- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3001

### Opção B: Apenas Bot (sem dashboard)

```bash
npm run dev
```

---

## Produção

### Build

```bash
npm run build
npm run build:web
```

### Start

```bash
npm start
```

Para servir o dashboard em produção, use Nginx/Caddy para servir `web/dist/` ou Vercel/Netlify.

---

## Testes

```bash
npm test
```

---

## Primeiro Login

1. Inicie bot e dashboard
2. Acesse http://localhost:5173
3. Login com senha `admin` (desenvolvimento)
4. Configure senha real em produção via `ADMIN_PASSWORD_HASH`

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

### Dashboard
- Ver status ao vivo
- Histórico de partidas
- Ranking completo
- Cancelar partidas ativas

---

## Troubleshooting

**Bot não conecta ao chat:**
- Verifique `KICK_CHANNEL_SLUG` e `KICK_BOT_SLUG`
- Delete `.tokens.json` e refaça autenticação

**Dashboard não loga:**
- Verifique `API_PORT` e `VITE_API_URL`
- Em dev, senha é `admin` (sem hash)

**API retorna 401:**
- Token expirado (24h), faça login novamente

---

## Documentação Completa

- [API REST](docs/API-DASHBOARD.md)
- [Fase 3](docs/IMPLEMENTACAO-FASE-3.md)
- [Changelog](CHANGELOG.md)
