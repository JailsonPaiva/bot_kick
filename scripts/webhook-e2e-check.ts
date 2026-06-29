/**
 * Checklist Parte 6 — valida tunnel, bot, inscrição e probe do webhook.
 * Uso: npm run kick:webhook-check
 */

import "dotenv/config";
import {
  formatE2ECheckReport,
  runWebhookE2EChecks,
  summarizeE2EChecks,
} from "../src/kick/webhookE2ECheck.js";

async function main(): Promise<void> {
  console.log("=== Checklist Parte 6 — Webhook E2E ===\n");

  const checks = await runWebhookE2EChecks();
  console.log(formatE2ECheckReport(checks));

  const { allOk } = summarizeE2EChecks(checks);
  if (!allOk) {
    process.exit(1);
  }

  console.log("\nPróximo passo: abra o chat do canal na Kick e envie uma mensagem de teste.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
