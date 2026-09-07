# Configuração CORS para Frontend Vercel

## Alterações Realizadas

O código foi atualizado para suportar múltiplas origens CORS através da variável de ambiente `CORS_ORIGIN`. As origens devem ser separadas por vírgula.

### Mudanças no código (`src/api/server.ts`):

```typescript
// Antes:
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// Depois:
const CORS_ORIGIN_ENV = process.env.CORS_ORIGIN || "http://localhost:3000";
const CORS_ORIGINS = CORS_ORIGIN_ENV.split(",").map((origin) => origin.trim());
```

## Configuração no Railway

### Passo 1: Acessar as variáveis de ambiente

1. Acesse o Railway: https://railway.app
2. Navegue até o projeto `botkick-production`
3. Clique na aba **Variables**

### Passo 2: Configurar CORS_ORIGIN

Adicione ou edite a variável `CORS_ORIGIN` com o seguinte valor:

```
http://localhost:3000,https://bot-kick-three.vercel.app
```

**Importante:**
- Não adicione espaços após as vírgulas (o código já faz o trim)
- Use `https://` para o domínio Vercel (não use `http://`)
- Mantenha `http://localhost:3000` para testes locais

### Passo 3: Deploy automático

O Railway detectará automaticamente o push no GitHub e iniciará um novo deploy.
Aguarde o deploy completar (você pode ver o progresso nos logs).

## Verificação

### 1. Verificar logs do Railway

Após o deploy, verifique os logs do Railway para confirmar que as origens estão corretas:

```
[API] CORS origens permitidas: http://localhost:3000, https://bot-kick-three.vercel.app
```

### 2. Testar do Frontend

Abra o console do navegador em `https://bot-kick-three.vercel.app` e verifique se as requisições para `https://botkick-production.up.railway.app` estão funcionando sem erros de CORS.

### 3. Teste manual via curl

Você também pode testar com curl:

```bash
curl -H "Origin: https://bot-kick-three.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://botkick-production.up.railway.app/api/health
```

Deve retornar headers CORS incluindo:
```
Access-Control-Allow-Origin: https://bot-kick-three.vercel.app
```

## Troubleshooting

### Erro: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Causa:** A variável de ambiente não foi configurada ou o deploy não completou.

**Solução:**
1. Verifique se a variável `CORS_ORIGIN` está configurada no Railway
2. Confirme que o último deploy foi bem-sucedido
3. Verifique os logs do Railway para ver quais origens estão sendo permitidas

### Erro: "CORS policy: The response had HTTP status code 503"

**Causa:** O servidor Railway pode estar reiniciando ou com problemas.

**Solução:**
1. Aguarde alguns minutos e tente novamente
2. Verifique os logs do Railway para erros de aplicação
3. Certifique-se de que todas as dependências estão instaladas

## Múltiplos domínios

Se você precisar adicionar mais domínios no futuro (por exemplo, domínio customizado), basta adicionar na variável `CORS_ORIGIN`:

```
http://localhost:3000,https://bot-kick-three.vercel.app,https://seu-dominio-customizado.com
```
