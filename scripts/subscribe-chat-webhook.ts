/**
 * Garante inscrição webhook em chat.message.sent (Parte 5).
 * Uso: npm run kick:subscribe-chat
 */

import "dotenv/config";
import {
  ensureChatWebhookSubscription,
  listEventSubscriptions,
  findChatMessageSentSubscription,
} from "../src/kick/eventSubscriptions.js";

async function main(): Promise<void> {
  const result = await ensureChatWebhookSubscription();

  const subscriptions = await listEventSubscriptions();
  const active = findChatMessageSentSubscription(subscriptions);

  console.log(
    result.created
      ? "Inscrição criada com sucesso."
      : "Inscrição já existia — nenhuma ação necessária."
  );
  console.log(`subscription_id: ${result.subscriptionId}`);

  if (active) {
    console.log(
      `Ativa na Kick: event=${active.event} v${active.version} method=${active.method}`
    );
  }

  console.log(`Total de inscrições ativas: ${subscriptions.length}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
