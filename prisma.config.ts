import "dotenv/config";
import { defineConfig } from "prisma/config";

// Fallback para build time - usa variável de ambiente ou valor dummy
const databaseUrl = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
