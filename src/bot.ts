/**
 * Entrypoint do bot Kick — conecta OAuth, WebSocket, banco e roteador de comandos.
 */

import "dotenv/config";
import { ensureAuthenticated } from "./auth/authManager.js";
import { getAuthenticatedBroadcasterId } from "./auth/userInfo.js";
import { WsListener, resolveChatroomId } from "./chat/wsListener.js";
import type { ChatMessage } from "./chat/types.js";
import { createCommandRouter } from "./commands/index.js";
import { createGameServices, setupGameServices } from "./games/index.js";
import { timerService } from "./timers/timerService.js";
import { checkModeration } from "./moderation/moderationService.js";
import { loyaltyService } from "./loyalty/loyaltyService.js";
import { startApiServer } from "./api/index.js";
import { requireEnv } from "./utils/env.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("=== Kick Bot v4 — PostgreSQL + Redis ===");

  const channelSlug = requireEnv("KICK_CHANNEL_SLUG");
  const botSlug = requireEnv("KICK_BOT_SLUG");

  await ensureAuthenticated();
  logger.info("Autenticação OK");

  const [chatroomId, broadcasterId] = await Promise.all([
    resolveChatroomId(channelSlug),
    getAuthenticatedBroadcasterId(),
  ]);

  const services = createGameServices();
  await setupGameServices(services, broadcasterId);

  // Fase 2 — iniciar timers
  await timerService.start(broadcasterId, channelSlug);

  const { server: apiServer, io } = startApiServer(services);

  const router = createCommandRouter(
    services.registry,
    services.playerRepository,
    loyaltyService
  );

  const listener = new WsListener(chatroomId);

  listener.on("message", (msg: ChatMessage) => {
    void (async () => {
      // Fase 3 — pontos por atividade no chat (janela configurável)
      await loyaltyService.trackChatActivity(channelSlug, msg);

      // Fase 2 — moderação antes do roteamento
      const modResult = await checkModeration(msg, channelSlug, broadcasterId);
      if (modResult.blocked) return;

      await router.dispatch(msg, {
        message: msg,
        broadcasterId,
        botSlug,
        channelSlug,
        chatroomId,
      });
    })();
  });

  listener.on("connected", () => {
    const commands = router.getRegisteredCommands().map((c) => `!${c}`).join(" | ");
    logger.info("Bot online — aguardando mensagens no chat...");
    logger.info(`Comandos built-in: ${commands}`);
    logger.info("Comandos customizáveis disponíveis via dashboard → /api/commands");
    logger.info("Loyalty: !pontos | !top | !dar @usuario quantidade");
    logger.info("Mini games: !ttt join | !ttt 1-9 | !ttt web | !ttt board | !demo start");
    logger.info("Ranking: !rank | !rank me | !rank @usuario");
  });

  listener.on("error", (err: Error) => {
    logger.error("Erro no listener WebSocket", err);
  });

  listener.connect();

  const shutdown = (): void => {
    logger.info("Encerrando bot...");
    listener.disconnect();
    services.gameManager.shutdown();
    timerService.stop();
    apiServer.close();
    io.close();
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
  process.exit(1);
});
