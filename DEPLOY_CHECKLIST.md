# ✅ Checklist de Deploy - CORS Frontend Vercel

## 📝 Alterações Realizadas

- ✅ Código atualizado para suportar múltiplas origens CORS
- ✅ Build compilado sem erros
- ✅ Commit e push para GitHub realizado

## 🚀 Próximos Passos

### 1. Configurar Railway (⏱️ ~2 minutos)

Acesse: https://railway.app/project/botkick-production

1. Clique em **Variables**
2. Adicione ou edite `CORS_ORIGIN`:
   ```
   http://localhost:3000,https://bot-kick-three.vercel.app
   ```
3. Salve (Railway irá redesployar automaticamente)

### 2. Aguardar Deploy (⏱️ ~2-3 minutos)

- O Railway detectará o push do GitHub automaticamente
- Acompanhe o progresso na aba **Deployments**
- Aguarde até o status ficar "Success" 🟢

### 3. Verificar Logs

Após o deploy, verifique os logs para confirmar:

```
[API] CORS origens permitidas: http://localhost:3000, https://bot-kick-three.vercel.app
```

### 4. Testar CORS

**Opção A: Via Frontend Vercel (Recomendado)**

1. Acesse: https://bot-kick-three.vercel.app
2. Abra DevTools (F12) > Console
3. Verifique se não há erros de CORS ao fazer requisições

**Opção B: Via Arquivo de Teste**

1. Abra o arquivo `test-cors.html` no navegador
2. Clique em "Testar /api/health"
3. Deve mostrar ✅ sucesso

**Opção C: Via cURL**

```bash
curl -i -H "Origin: https://bot-kick-three.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://botkick-production.up.railway.app/api/health
```

Deve retornar:
```
Access-Control-Allow-Origin: https://bot-kick-three.vercel.app
```

## 🔧 Troubleshooting

### ❌ Ainda vejo erro de CORS

**Verifique:**
- [ ] Variável `CORS_ORIGIN` configurada no Railway
- [ ] Deploy completou com sucesso (sem erros)
- [ ] Cache do navegador limpo (Ctrl+Shift+R)
- [ ] URL do frontend está correta (https, sem barra final)

### ❌ API não responde (503/504)

**Possíveis causas:**
- Railway está reiniciando o serviço
- Erro no código (verifique logs)
- Banco de dados ou Redis indisponíveis

**Solução:** Aguarde 2-3 minutos e tente novamente

### ❌ WebSocket não conecta

**Verifique:**
- CORS_ORIGIN inclui a origem correta
- URL do WebSocket usa `wss://` (não `ws://`)
- Firewall/proxy não está bloqueando WebSockets

## 📚 Arquivos de Referência

- `CORS_SETUP.md` - Documentação completa da configuração
- `test-cors.html` - Interface de teste interativa
- `src/api/server.ts` - Código fonte com as alterações

## ✨ Resultado Esperado

Após completar todos os passos, você deve ter:

1. ✅ Frontend Vercel conectando na API Railway
2. ✅ Sem erros de CORS no console
3. ✅ WebSocket funcionando
4. ✅ Testes locais (localhost:3000) ainda funcionando

---

**Data da Alteração:** 2026-09-07  
**Commit:** `feat: Suporte a múltiplas origens CORS incluindo Vercel`
