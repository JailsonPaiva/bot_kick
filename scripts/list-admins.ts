/**
 * Script para listar todos os admins
 * Uso: tsx scripts/list-admins.ts
 */

import { prisma } from "../src/infra/prisma/client.js";
import { logger } from "../src/utils/logger.js";

async function main() {
  console.log("\n👥 === Lista de Administradores ===\n");

  try {
    const admins = await prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (admins.length === 0) {
      console.log("❌ Nenhum admin encontrado.");
      return;
    }

    console.log(`Total: ${admins.length} admin(s)\n`);
    
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.username} (${admin.email})`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Ativo: ${admin.isActive ? "Sim" : "Não"}`);
      console.log(`   Criado em: ${admin.createdAt.toISOString()}`);
      console.log(`   Último login: ${admin.lastLoginAt ? admin.lastLoginAt.toISOString() : "Nunca"}`);
      console.log("");
    });
  } catch (error) {
    logger.error("Erro ao listar admins", error);
    console.error("❌ Erro ao listar admins:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
