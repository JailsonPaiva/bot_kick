# 🔐 Gerenciamento de Usuários Administradores

Este documento explica como gerenciar usuários administradores do dashboard usando o banco de dados PostgreSQL.

## 📋 Visão Geral

A partir desta versão, **não usamos mais** variáveis de ambiente (`.env`) para armazenar senhas de administrador. Todas as credenciais são armazenadas de forma segura no banco de dados PostgreSQL.

### ✅ Vantagens

- ✅ **Múltiplos admins**: Suporte para vários usuários administradores
- ✅ **Segurança**: Senhas hasheadas com bcrypt (10 rounds)
- ✅ **Auditoria**: Rastreamento de último login
- ✅ **Gerenciamento**: CRUD completo via API
- ✅ **Roles**: Suporte futuro para diferentes níveis de permissão



## 🚀 Primeiro Acesso (Criar Admin Inicial)



### No Railway (Produção)

Após o deploy, execute o script de seed para criar o primeiro administrador:

```bash
# Via Railway CLI
railway run npm run seed:admin
```

O script vai perguntar:

- Email
- Username
- Senha
- Confirmação de senha



### Local (Desenvolvimento)

```bash
# Com banco local rodando
npm run seed:admin
```



## 📊 Modelo AdminUser

```prisma
model AdminUser {
  id           String   @id @default(uuid())
  email        String   @unique
  username     String   @unique
  passwordHash String
  role         String   @default("admin")
  isActive     Boolean  @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```



## 🔑 API de Autenticação



### POST /api/auth/login

Login via email ou username:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@example.com",
    "password": "sua-senha"
  }'
```

**Resposta de sucesso:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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



### GET /api/auth/users

Listar todos os usuários (requer autenticação):

```bash
curl http://localhost:3001/api/auth/users \
  -H "Authorization: Bearer SEU_TOKEN"
```



### POST /api/auth/users

Criar novo usuário admin (requer autenticação):

```bash
curl -X POST http://localhost:3001/api/auth/users \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novo@example.com",
    "username": "novoadmin",
    "password": "senha-segura",
    "role": "admin"
  }'
```



### PUT /api/auth/users/:id

Atualizar usuário (requer autenticação):

```bash
curl -X PUT http://localhost:3001/api/auth/users/UUID \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novo-email@example.com",
    "isActive": false
  }'
```



### DELETE /api/auth/users/:id

Deletar usuário (requer autenticação):

```bash
curl -X DELETE http://localhost:3001/api/auth/users/UUID \
  -H "Authorization: Bearer SEU_TOKEN"
```

**⚠️ Proteção**: Não é possível deletar o último administrador ativo.

## 🔒 Segurança



### Hashing de Senhas

- Algoritmo: **bcrypt**
- Rounds: **10** (2^10 = 1024 iterações)
- Salt: Gerado automaticamente por bcrypt



### Rate Limiting

- Janela: **15 minutos**
- Máximo: **20 tentativas** por IP
- Reset automático após janela



### JWT

- Algoritmo: **HS256**
- Expiração: **24 horas**
- Secret: `API_JWT_SECRET` (variável de ambiente)



## 🛠️ Manutenção



### Resetar Senha de Usuário

Via psql no Railway:

```bash
# Conectar ao banco
railway run psql $DATABASE_URL

# Ver usuários
SELECT id, email, username, "isActive" FROM "AdminUser";

# Gerar novo hash (substitua 'nova-senha' pela senha desejada)
# Você pode usar Node.js para gerar o hash:
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('nova-senha', 10).then(console.log)"

# Atualizar no banco
UPDATE "AdminUser" 
SET "passwordHash" = 'HASH_GERADO_ACIMA' 
WHERE email = 'admin@example.com';
```



### Desativar Usuário

```sql
UPDATE "AdminUser" SET "isActive" = false WHERE email = 'usuario@example.com';
```



### Reativar Usuário

```sql
UPDATE "AdminUser" SET "isActive" = true WHERE email = 'usuario@example.com';
```



## ⚠️ Migração de .env

Se você tinha `ADMIN_PASSWORD_HASH` no `.env`, **remova essa variável** após criar o primeiro admin no banco.

**Antes (.env):**

```bash
ADMIN_PASSWORD_HASH=$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Depois:**

```bash
# ADMIN_PASSWORD_HASH removido - usuários agora no banco de dados
API_JWT_SECRET=seu-jwt-secret-aqui
```



## 📝 Checklist de Deploy

- [ ] Fazer deploy da nova versão com migration
- [ ] Rodar `railway run npm run seed:admin` para criar primeiro admin
- [ ] Testar login via API
- [ ] Remover `ADMIN_PASSWORD_HASH` do Railway Variables (se existir)
- [ ] Documentar credenciais do admin inicial em local seguro



## 🔍 Troubleshooting



### Erro: "Credenciais inválidas"

- Verifique se o usuário existe: `railway run psql $DATABASE_URL -c 'SELECT * FROM "AdminUser"'`
- Confirme que `isActive = true`
- Verifique se a senha está correta



### Erro: "Token inválido ou expirado"

- Token JWT expira em 24h
- Faça login novamente para obter novo token



### Erro: "Não é possível deletar o último administrador"

- Sempre deve existir pelo menos 1 admin ativo
- Crie outro admin antes de deletar o atual



## 📚 Referências

- [bcrypt](https://www.npmjs.com/package/bcryptjs)
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken)
- [Prisma Client](https://www.prisma.io/docs/concepts/components/prisma-client)

