#!/usr/bin/env tsx
/**
 * Script para criar usuário administrador via CLI (não-interativo).
 * 
 * Uso:
 *   tsx scripts/seed-admin-cli.ts EMAIL USERNAME PASSWORD
 *   
 * Exemplo:
 *   tsx scripts/seed-admin-cli.ts admin@example.com admin senha123
 */

import "dotenv/config";
import { createAdminUser, findAdminUserByEmail } from "../src/db/repositories/adminUserRepository.js";
import { logger } from "../src/utils/logger.js";

async function main(): Promise<void> {
  const [email, username, password] = process.argv.slice(2);

  if (!email || !username || !password) {
    console.error("❌ Uso: tsx scripts/seed-admin-cli.ts EMAIL USERNAME PASSWORD");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("❌ Senha deve ter pelo menos 6 caracteres!");
    process.exit(1);
  }

  console.log("🔐 === Criando Usuário Administrador ===\n");
  console.log(`Email: ${email}`);
  console.log(`Username: ${username}`);
  console.log(`Senha: ${"*".repeat(password.length)}\n`);

  try {
    // Verificar se já existe
    const existing = await findAdminUserByEmail(email);
    if (existing) {
      console.error(`❌ Já existe um usuário com o email: ${email}`);
      process.exit(1);
    }

    // Criar usuário
    const user = await createAdminUser({
      email,
      username,
      password,
      role: "admin",
    });

    console.log("\n✅ Usuário administrador criado com sucesso!");
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Created: ${user.createdAt}`);

    logger.info("Admin user created via CLI", { 
      userId: user.id, 
      email: user.email,
      username: user.username 
    });
  } catch (error) {
    console.error("\n❌ Erro ao criar usuário:");
    console.error(error);
    logger.error("Erro ao criar admin via CLI", error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Erro fatal ao criar admin", error);
  process.exit(1);
});
