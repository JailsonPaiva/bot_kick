import { defineConfig } from "prisma/config";

// Não carrega .env durante build - apenas em runtime
// Durante build, usa valor dummy passado via CLI
const databaseUrl = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
