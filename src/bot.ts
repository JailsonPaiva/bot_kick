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
import { giveawayService } from "./engagement/giveawayService.js";
import { startApiServer } from "./api/index.js";
import { requireEnv } from "./utils/env.js";
import { logger } from "./utils/logger.js";
import { connectRedis } from "./infra/redis/redisClient.js";
import { isModuleEnabled } from "./ops/featureFlags.js";
import { metrics } from "./ops/metrics.js";
import { eventQueue } from "./ops/eventQueue.js";

async function main(): Promise<void> {
  logger.info("=== Kick Bot v4 — PostgreSQL + Redis ===");

  const channelSlug = requireEnv("KICK_CHANNEL_SLUG");
  const botSlug = requireEnv("KICK_BOT_SLUG");

  try {
    await connectRedis();
    logger.info("Redis conectado", { module: "infra" });
  } catch (err) {
    logger.warn("Redis indisponível — piloto segue com memória local", {
      module: "infra",
    }, err);
  }

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
      if (isModuleEnabled(channelSlug, "loyalty")) {
        await loyaltyService.trackChatActivity(channelSlug, msg);
      }

      if (isModuleEnabled(channelSlug, "moderation")) {
        const modResult = await checkModeration(msg, channelSlug, broadcasterId);
        if (modResult.blocked) return;
      }

      if (
        isModuleEnabled(channelSlug, "giveaways") &&
        msg.sender.slug.toLowerCase() !== botSlug.toLowerCase()
      ) {
        await giveawayService.tryEnterFromChat(channelSlug, {
          kickUserId: msg.sender.id,
          username: msg.sender.username,
          slug: msg.sender.slug,
          badges: msg.sender.identity.badges,
        });
      }

      if (isModuleEnabled(channelSlug, "commands")) {
        metrics.recordCommand();
        await router.dispatch(msg, {
          message: msg,
          broadcasterId,
          botSlug,
          channelSlug,
          chatroomId,
        });
      }
    })();
  });

  listener.on("connected", () => {
    const commands = router.getRegisteredCommands().map((c) => `!${c}`).join(" | ");
    logger.info("Bot online — aguardando mensagens no chat...");
    logger.info(`Fila de eventos pronta depth=${eventQueue.size()}`, {
      module: "queue",
    });
    logger.info(`Comandos built-in: ${commands}`);
    logger.info("Comandos customizáveis disponíveis via dashboard → /api/commands");
    logger.info("Loyalty: !pontos | !top | !dar @usuario quantidade");
    logger.info("Fase 4: !sorteio | !entrar | !reroll | !poll | !votar");
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
