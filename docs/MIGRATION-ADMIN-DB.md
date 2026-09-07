# 🔄 Migração: Sistema de Admin Users no Banco de Dados

## 📋 Resumo das Mudanças

Removemos a dependência de variáveis de ambiente (`.env`) para armazenar senhas de administrador. Agora todos os usuários administradores são gerenciados via banco de dados PostgreSQL.

## 🎯 O que mudou?

### ❌ Antes (Deprecated)

```bash
# .env
ADMIN_PASSWORD_HASH=$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Login era feito com:
```json
POST /api/auth/login
{
  "password": "senha-do-env"
}
```

### ✅ Depois (Atual)

**Usuários armazenados no PostgreSQL:**

```sql
-- Tabela AdminUser
id, email, username, passwordHash, role, isActive, lastLoginAt, createdAt, updatedAt
```

Login via email ou username:
```json
POST /api/auth/login
{
  "identifier": "admin@example.com",
  "password": "senha-do-usuario"
}
```

## 📦 Novos Arquivos

### 1. Schema Prisma
- `prisma/schema.prisma` - Modelo `AdminUser` adicionado
- `prisma/migrations/20260907_add_admin_users/migration.sql` - Migration SQL

### 2. Repository
- `src/db/repositories/adminUserRepository.ts` - CRUD completo de usuários admin

### 3. Scripts
- `scripts/seed-admin.ts` - Script interativo para criar primeiro admin
- `package.json` - Novo comando: `npm run seed:admin`

### 4. API
- `src/api/routes/auth.ts` - Novas rotas:
  - `GET /api/auth/users` - Listar admins
  - `POST /api/auth/users` - Criar admin
  - `PUT /api/auth/users/:id` - Atualizar admin
  - `DELETE /api/auth/users/:id` - Deletar admin
- `src/api/auth.ts` - Função `verifyPassword` marcada como deprecated

### 5. Documentação
- `docs/ADMIN-USERS.md` - Guia completo do sistema de admin users
- `docs/MIGRATION-ADMIN-DB.md` - Este arquivo

## 🚀 Passo a Passo: Deploy no Railway

### 1. Fazer Push do Código (✅ Já Feito)

```bash
git push origin main
```

O Railway vai detectar e fazer o build automaticamente.

### 2. Aguardar Build Completar

Monitore: https://railway.com/project/cec5d108-592b-4ff1-9f90-86e2136dc315

O que acontece no build:
- ✅ `npm install`
- ✅ `prisma generate`
- ✅ `npm run build`
- ✅ Deploy
- ✅ `prisma migrate deploy` (roda a nova migration do AdminUser)

### 3. Criar Primeiro Admin (📝 Próximo Passo)

Após o deploy bem-sucedido, execute:

```bash
railway run npm run seed:admin
```

O script vai perguntar:
```
Email: admin@exemplo.com
Username: admin
Senha: ••••••••
Confirmar senha: ••••••••
```

### 4. Testar Login

```bash
# Obter a URL do Railway
railway domain

# Testar login
curl -X POST https://sua-url.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@exemplo.com",
    "password": "sua-senha"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@exemplo.com",
      "role": "admin"
    }
  },
  "message": "Login realizado com sucesso"
}
```

### 5. Remover Variável Antiga (Opcional)

Se você tinha `ADMIN_PASSWORD_HASH` nas variáveis do Railway:

```bash
railway variables delete ADMIN_PASSWORD_HASH
```

## 🔒 Segurança

### Senhas
- ✅ Hasheadas com **bcrypt** (10 rounds)
- ✅ Nunca expostas em logs ou respostas da API
- ✅ Salt gerado automaticamente

### Rate Limiting
- ✅ 20 tentativas de login por IP a cada 15 minutos
- ✅ Proteção contra brute-force

### JWT
- ✅ Tokens expiram em 24 horas
- ✅ Secret configurável via `API_JWT_SECRET`

### Auditoria
- ✅ `lastLoginAt` registra último acesso
- ✅ Campo `isActive` para desativar usuários

## 📝 Checklist de Deploy

- [x] Atualizar schema Prisma com modelo AdminUser
- [x] Criar migration SQL
- [x] Criar repository adminUserRepository
- [x] Atualizar rotas de autenticação
- [x] Criar script seed-admin
- [x] Adicionar documentação
- [x] Fazer push para GitHub
- [ ] **Build Railway completar com sucesso**
- [ ] **Rodar `railway run npm run seed:admin`**
- [ ] **Testar login via API**
- [ ] **Remover `ADMIN_PASSWORD_HASH` do Railway (se existir)**
- [ ] **Atualizar frontend para usar novo formato de login**

## ⚠️ Breaking Changes

### Frontend

O endpoint de login mudou:

**Antes:**
```typescript
fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ password: 'senha' })
})
```

**Depois:**
```typescript
fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ 
    identifier: 'admin@example.com',  // email ou username
    password: 'senha' 
  })
})
```

### Resposta do Login

**Antes:**
```json
{
  "success": true,
  "data": { "token": "..." },
  "message": "Login realizado com sucesso"
}
```

**Depois:**
```json
{
  "success": true,
  "data": { 
    "token": "...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin"
    }
  },
  "message": "Login realizado com sucesso"
}
```

## 🔍 Troubleshooting

### Erro: "Credenciais inválidas"

Verifique se o admin foi criado:

```bash
railway run psql $DATABASE_URL -c 'SELECT email, username, "isActive" FROM "AdminUser"'
```

### Erro: "Token inválido"

- Token expira em 24h
- Faça login novamente
- Verifique se `API_JWT_SECRET` está configurado

### Erro ao rodar seed:admin

```bash
# Ver logs detalhados
railway logs --follow

# Verificar se migrations rodaram
railway run npx prisma migrate status
```

## 📚 Documentação Completa

Leia: [`docs/ADMIN-USERS.md`](./ADMIN-USERS.md)

## 🎉 Benefícios

- ✅ **Múltiplos admins** - Não mais limitado a 1 senha global
- ✅ **Auditoria** - Rastreamento de acessos
- ✅ **Segurança** - Senhas hasheadas, não em variáveis de ambiente
- ✅ **Escalabilidade** - Fácil adicionar/remover/editar usuários
- ✅ **Roles** - Base para sistema de permissões futuro
- ✅ **API completa** - CRUD de usuários via REST
