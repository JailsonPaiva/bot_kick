# 🚀 Deploy Rápido no Railway

Execute este script interativo para fazer o deploy completo:

```bash
node scripts/railway-deploy.js
```

O script irá:
1. ✅ Criar projeto Railway
2. ✅ Provisionar PostgreSQL
3. ✅ Provisionar Redis  
4. ✅ Configurar variáveis de ambiente
5. ✅ Fazer deploy
6. ✅ Gerar URL pública

## Ou faça manualmente:

### 1. Login
```bash
railway login
```

### 2. Criar projeto
```bash
railway init
```

### 3. Adicionar bancos
```bash
railway add --plugin postgresql
railway add --plugin redis
```

### 4. Configurar variáveis
Use `.env.railway` como referência e configure:
```bash
railway variables set KICK_CLIENT_ID="seu_valor"
railway variables set KICK_CLIENT_SECRET="seu_valor"
# ... etc
```

### 5. Deploy
```bash
railway up
```

### 6. Gerar domínio
```bash
railway domain
```

### 7. Pós-deploy
```bash
# Configurar URL pública (copie a URL gerada acima)
railway variables set PUBLIC_API_URL="https://seu-projeto.railway.app"

# Reautenticar OAuth
railway run npm run auth:relogin

# Registrar webhook
railway run npm run kick:subscribe-chat
```

### 8. Monitorar
```bash
railway logs
```

---

📚 **Documentação completa**: `docs/DEPLOY-RAILWAY.md`
