#!/usr/bin/env node

/**
 * Script de deploy automatizado para Railway
 * 
 * Executa:
 * 1. railway init (cria projeto)
 * 2. railway add postgres
 * 3. railway add redis
 * 4. Configura variáveis de ambiente essenciais
 * 5. railway up (deploy)
 * 6. railway domain (gera URL pública)
 */

import { execSync } from 'node:child_process';
import * as readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function exec(command, description) {
  console.log(`\n🔧 ${description}...`);
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: 'inherit' 
    });
    console.log(`✅ ${description} - OK`);
    return output;
  } catch (error) {
    console.error(`❌ Erro ao ${description}`);
    throw error;
  }
}

async function main() {
  console.log('🚂 === Railway Deploy Script === \n');

  // 1. Verificar login
  console.log('📋 Verificando autenticação Railway...');
  try {
    execSync('railway whoami', { encoding: 'utf-8', stdio: 'ignore' });
    console.log('✅ Autenticado no Railway');
  } catch {
    console.log('❌ Não autenticado. Execute: railway login');
    process.exit(1);
  }

  // 2. Inicializar projeto
  const projectName = await prompt('\n📦 Nome do projeto Railway (ex: kick-bot-prod): ');
  exec(`railway init --name "${projectName}"`, 'Criando projeto Railway');

  // 3. Adicionar PostgreSQL
  exec('railway add --database postgres', 'Provisionando PostgreSQL');

  // 4. Adicionar Redis
  exec('railway add --database redis', 'Provisionando Redis');

  // 5. Configurar variáveis de ambiente
  console.log('\n🔐 === Configuração de Variáveis de Ambiente ===');
  console.log('Nota: DATABASE_URL e REDIS_URL são injetados automaticamente pelos plugins\n');

  const kickClientId = await prompt('KICK_CLIENT_ID: ');
  const kickClientSecret = await prompt('KICK_CLIENT_SECRET: ');
  const kickChannelSlug = await prompt('KICK_CHANNEL_SLUG: ');
  const kickBotSlug = await prompt('KICK_BOT_SLUG: ');
  const kickChatroomId = await prompt('KICK_CHATROOM_ID: ');
  const jwtSecret = await prompt('API_JWT_SECRET (deixe vazio para gerar): ') 
    || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const corsOrigin = await prompt('CORS_ORIGIN (ex: https://seu-frontend.vercel.app): ') 
    || 'http://localhost:3000';

  console.log('\n⚙️  Configurando variáveis...');

  const variables = {
    KICK_CLIENT_ID: kickClientId,
    KICK_CLIENT_SECRET: kickClientSecret,
    KICK_CHANNEL_SLUG: kickChannelSlug,
    KICK_BOT_SLUG: kickBotSlug,
    KICK_CHATROOM_ID: kickChatroomId,
    API_PORT: '3001',
    API_JWT_SECRET: jwtSecret,
    CORS_ORIGIN: corsOrigin,
    LOYALTY_POINTS_PER_ACTIVITY: '1',
    LOYALTY_ACTIVITY_INTERVAL_SECONDS: '60',
    KICK_WEBHOOK_PATH: '/api/kick/webhooks/events',
    KICK_WEBHOOK_SKIP_VERIFY: 'false',
    GIVEAWAY_DEFAULT_FILTER: 'everyone',
    POLL_DEFAULT_DURATION_SECONDS: '60',
  };

  for (const [key, value] of Object.entries(variables)) {
    try {
      execSync(`railway variables set ${key}="${value}"`, { stdio: 'ignore' });
      console.log(`  ✓ ${key}`);
    } catch (error) {
      console.error(`  ✗ Erro ao configurar ${key}`);
    }
  }

  console.log('\n✅ Variáveis configuradas');

  // 6. Deploy
  const doDeploy = await prompt('\n🚀 Fazer deploy agora? (s/n): ');
  if (doDeploy.toLowerCase() === 's') {
    exec('railway up', 'Fazendo deploy');

    console.log('\n🌐 Gerando domínio público...');
    exec('railway domain', 'Configurando domínio');

    console.log('\n🎉 === Deploy Concluído! ===');
    console.log('\n📝 Próximos passos:');
    console.log('1. Copie a URL gerada acima');
    console.log('2. Configure PUBLIC_API_URL no Railway:');
    console.log('   railway variables set PUBLIC_API_URL="<sua-url>"');
    console.log('3. Reautentique o bot OAuth:');
    console.log('   railway run npm run auth:relogin');
    console.log('4. Registre webhook do Kick:');
    console.log('   railway run npm run kick:subscribe-chat');
    console.log('\n5. Configure webhook no Kick Developer Portal:');
    console.log('   <sua-url>/api/kick/webhooks/events');
    console.log('\n6. Monitore logs:');
    console.log('   railway logs');
  } else {
    console.log('\n📦 Projeto configurado. Deploy cancelado.');
    console.log('Execute "railway up" quando estiver pronto.');
  }

  rl.close();
}

main().catch((error) => {
  console.error('\n❌ Erro fatal:', error.message);
  process.exit(1);
});
