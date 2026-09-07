import type { Config } from "@railway/cli";

export default {
  build: {
    builder: "NIXPACKS",
  },
  deploy: {
    startCommand: "npm run prisma:migrate:deploy && npm start",
    healthcheckPath: "/api/health",
    healthcheckTimeout: 300,
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 10,
  },
} satisfies Config;
