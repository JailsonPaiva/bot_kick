/**
 * Script para resetar senha de admin existente
 * Uso: tsx scripts/reset-admin-password.ts <email> <nova-senha>
 */

import { prisma } from "../src/infra/prisma/client.js";
import bcrypt from "bcryptjs";
import { logger } from "../src/utils/logger.js";

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error("❌ Uso: tsx scripts/reset-admin-password.ts <email> <nova-senha>");
    process.exit(1);
  }

  console.log("\n🔐 === Resetando Senha de Admin ===\n");
  console.log(`Email: ${email}`);
  console.log(`Nova Senha: ${"*".repeat(newPassword.length)}\n`);

  try {
    // Buscar admin
    const admin = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin) {
      console.error(`❌ Admin com email ${email} não encontrado.`);
      process.exit(1);
    }

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await prisma.adminUser.update({
      where: { email },
      data: { passwordHash },
    });

    console.log("✅ Senha atualizada com sucesso!");
    console.log(`\nCredenciais de login:`);
    console.log(`Email: ${email}`);
    console.log(`Senha: ${newPassword}`);
    console.log(`\nAcesse: https://bot-kick-three.vercel.app`);
  } catch (error) {
    logger.error("Erro ao resetar senha", error);
    console.error("❌ Erro ao resetar senha:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
