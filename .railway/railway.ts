import type { Config } from "@railway/cli";

export default {
  build: {
    builder: "NIXPACKS",
    buildCommand: "npm cache clean --force && npm install --production=false && DATABASE_URL=postgresql://user:pass@localhost:5432/db npx prisma generate && npm run build",
  },
  deploy: {
    startCommand: "npx prisma migrate deploy && npm start",
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 10,
  },
} satisfies Config;
