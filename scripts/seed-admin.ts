#!/usr/bin/env tsx
/**
 * Script para criar o primeiro usuário administrador no banco de dados.
 * 
 * Uso:
 *   npm run seed:admin
 *   
 * Ou via Railway:
 *   railway run npm run seed:admin
 */

import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createAdminUser, findAdminUserByEmail } from "../src/db/repositories/adminUserRepository.js";
import { logger } from "../src/utils/logger.js";

const rl = readline.createInterface({ input, output });

async function main(): Promise<void> {
  console.log("🔐 === Criar Usuário Administrador ===\n");

  const email = await rl.question("Email: ");
  const username = await rl.question("Username: ");
  const password = await rl.question("Senha: ");
  const passwordConfirm = await rl.question("Confirmar senha: ");

  if (password !== passwordConfirm) {
    console.error("❌ Senhas não conferem!");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("❌ Senha deve ter pelo menos 6 caracteres!");
    process.exit(1);
  }

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

    logger.info("Admin user created", { userId: user.id, email: user.email });
  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  logger.error("Erro fatal ao criar admin", error);
  process.exit(1);
});
