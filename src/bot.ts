/**
 * Entrypoint do bot Kick — conecta OAuth, WebSocket, banco e roteador de comandos.
 */

import "dotenv/config";
import { ensureAuthenticated } from "./auth/authManager.js";
import { getAuthenticatedBroadcasterId } from "./auth/userInfo.js";
import { WsListener, resolveChatroomId } from "./chat/wsListener.js";
import type { ChatMessage } from "./chat/types.js";
import { createCommandRouter } from "./commands/index.js";
import { initDatabase, closeDatabase } from "./db/index.js";
import { createGameServices, setupGameServices } from "./games/index.js";
import { requireEnv } from "./utils/env.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("=== Kick Bot — OAuth + Echo MVP ===");

  const channelSlug = requireEnv("KICK_CHANNEL_SLUG");
  const botSlug = requireEnv("KICK_BOT_SLUG");

  initDatabase();

  await ensureAuthenticated();
  logger.info("Autenticação OK");

  const [chatroomId, broadcasterId] = await Promise.all([
    resolveChatroomId(channelSlug),
    getAuthenticatedBroadcasterId(),
  ]);

  const services = createGameServices();
  setupGameServices(services, broadcasterId);
  const { gameManager, registry } = services;
  const router = createCommandRouter(registry);
  const listener = new WsListener(chatroomId);

  listener.on("message", (msg: ChatMessage) => {
    void router.dispatch(msg, {
      message: msg,
      broadcasterId,
      botSlug,
      channelSlug,
      chatroomId,
    });
  });

  listener.on("connected", () => {
    const commands = router.getRegisteredCommands().map((c) => `!${c}`).join(" | ");
    logger.info("Bot online — aguardando mensagens no chat...");
    logger.info(`Comandos: ${commands}`);
    logger.info("Mini games: !ttt join | !ttt 1-9 | !ttt board | !demo start");
  });

  listener.on("error", (err: Error) => {
    logger.error("Erro no listener WebSocket", err);
  });

  listener.connect();

  const shutdown = (): void => {
    logger.info("Encerrando bot...");
    listener.disconnect();
    gameManager.shutdown();
    closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("uncaughtException", (err) => {
    logger.error("Exceção não tratada", err);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Promise rejeitada não tratada", reason);
  });
}

main().catch((err) => {
  logger.error("Falha fatal ao iniciar o bot", err);
  closeDatabase();
  process.exit(1);
});
