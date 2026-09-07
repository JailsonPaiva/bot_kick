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
import { broadcastChatMessage } from "./api/chatEvents.js";
import { requireEnv } from "./utils/env.js";
import { logger } from "./utils/logger.js";
import { connectRedis } from "./infra/redis/redisClient.js";
import { isModuleEnabled } from "./ops/featureFlags.js";
import { metrics } from "./ops/metrics.js";
import { eventQueue } from "./ops/eventQueue.js";

function relayWsMessageToDashboard(channelSlug: string, msg: ChatMessage): void {
  broadcastChatMessage(channelSlug, {
    id: msg.id,
    content: msg.content ?? "",
    createdAt: msg.created_at,
    channelSlug,
    sender: {
      userId: msg.sender.id,
      username: msg.sender.username,
      color: msg.sender.identity.color,
      badges: (msg.sender.identity.badges ?? []).map((badge) => ({
        type: badge.type,
        text: badge.text,
      })),
    },
  });
}

async function main(): Promise<void> {
  logger.info("=== Kick Bot v4 — PostgreSQL + Redis ===");

  // Modo API-only: se não tiver KICK_CHANNEL_SLUG, roda apenas a API
  const channelSlug = process.env.KICK_CHANNEL_SLUG;
  const botSlug = process.env.KICK_BOT_SLUG;
  const apiOnlyMode = !channelSlug || !botSlug;

  if (apiOnlyMode) {
    logger.info("=== MODO API-ONLY: Bot Kick desabilitado (faltam KICK_CHANNEL_SLUG ou KICK_BOT_SLUG) ===");
    logger.info("Apenas a API REST estará disponível");
  }

  try {
    await connectRedis();
    logger.info("Redis conectado", { module: "infra" });
  } catch (err) {
    logger.warn("Redis indisponível — piloto segue com memória local", {
      module: "infra",
    }, err);
  }

  // Se não estiver em modo API-only, tentar autenticação
  if (!apiOnlyMode && channelSlug && botSlug) {
    try {
      await ensureAuthenticated();
      logger.info("Autenticação OK");
    } catch (error) {
      logger.error("Falha na autenticação OAuth - continuando em modo API-only", error);
      // Continuar sem OAuth - apenas API funcionará
    }
  }

  const services = createGameServices();
  
  // Iniciar API Server primeiro (sempre disponível)
  const { server: apiServer, io } = startApiServer(services);
  
  // Se em modo API-only, apenas iniciar API e retornar
  if (apiOnlyMode) {
    logger.info("API Server iniciado em modo API-only");
    logger.info(`Dashboard disponível - configure KICK_CHANNEL_SLUG e KICK_BOT_SLUG para habilitar o bot`);
    return; // Não inicializar bot/websocket/chat
  }

  // Modo completo: iniciar bot + API
  const [chatroomId, broadcasterId] = await Promise.all([
    resolveChatroomId(channelSlug!),
    getAuthenticatedBroadcasterId(),
  ]);

  await setupGameServices(services, broadcasterId);

  // Fase 2 — iniciar timers
  await timerService.start(broadcasterId, channelSlug!);

  const router = createCommandRouter(
    services.registry,
    services.playerRepository,
    loyaltyService
  );

  const listener = new WsListener(chatroomId);

  listener.on("message", (msg: ChatMessage) => {
    void (async () => {
      // Fallback de chat ao vivo: se webhook não chegar, o dashboard ainda recebe via WS do bot
      if (isModuleEnabled(channelSlug!, "chat")) {
        relayWsMessageToDashboard(channelSlug!, msg);
      }

      if (isModuleEnabled(channelSlug!, "loyalty")) {
        await loyaltyService.trackChatActivity(channelSlug!, msg);
      }

      if (isModuleEnabled(channelSlug!, "moderation")) {
        const modResult = await checkModeration(msg, channelSlug!, broadcasterId);
        if (modResult.blocked) return;
      }

      if (
        isModuleEnabled(channelSlug!, "giveaways") &&
        msg.sender.slug.toLowerCase() !== botSlug!.toLowerCase()
      ) {
        await giveawayService.tryEnterFromChat(channelSlug!, {
          kickUserId: msg.sender.id,
          username: msg.sender.username,
          slug: msg.sender.slug,
          badges: msg.sender.identity.badges,
        });
      }

      if (isModuleEnabled(channelSlug!, "commands")) {
        metrics.recordCommand();
        await router.dispatch(msg, {
          message: msg,
          broadcasterId,
          botSlug: botSlug!,
          channelSlug: channelSlug!,
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
