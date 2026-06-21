# API REST e Dashboard Web - Guia de Uso

## Visão Geral

O bot agora possui uma API REST completa e um dashboard web para administração.

## API REST

### Configuração

Adicione as variáveis no `.env`:

```bash
API_PORT=3001
CORS_ORIGIN=http://localhost:5173
API_JWT_SECRET=sua-chave-secreta-aqui
ADMIN_PASSWORD_HASH=
```

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

---

## Dashboard Web

### Setup

```bash
cd web
npm install
cp .env.example .env
```

Edite `.env`:
```bash
VITE_API_URL=http://localhost:3001
```

### Desenvolvimento

```bash
cd web
npm run dev
```

Acesse: http://localhost:5173

### Produção

```bash
cd web
npm run build
```

Os arquivos estarão em `web/dist/`.

### Login

Senha padrão em desenvolvimento: `admin`

Em produção, configure `ADMIN_PASSWORD_HASH` no `.env` do bot.

### Páginas Disponíveis

- **Dashboard**: Status ao vivo do bot, uptime, partidas ativas
- **Jogos**: Histórico de todas as partidas
- **Ranking**: Top jogadores com pontos, vitórias, derrotas

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

---

## Estrutura de Arquivos

```
src/
├── api/
│   ├── types.ts          # Tipos TypeScript
│   ├── auth.ts           # JWT e autenticação
│   ├── server.ts         # Servidor Express
│   └── routes/
│       ├── auth.ts       # POST /api/auth/login
│       ├── status.ts     # GET /api/status
│       ├── games.ts      # GET/DELETE /api/games
│       └── players.ts    # GET /api/players
├── bot.ts                # Inicializa API junto com bot
└── ...

web/
├── src/
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Games.tsx
│   │   └── Ranking.tsx
│   ├── components/
│   │   └── Layout.tsx
│   └── App.tsx
└── ...
```

---

## Próximos Passos (Opcionais)

Consulte o plano completo em `.cursor/plans/evolução_bot_kick_fase_3_*.plan.md`:

- Interface web para jogadores (jogo da velha no browser)
- Mini game Quiz/Trivia
- Integração CS2 com RCON
- OBS Overlays
