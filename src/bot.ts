/**
 * Entrypoint do bot Kick — conecta OAuth, WebSocket e handlers de echo.
 * Comandos: !echo, !ping, !auth
 */

import "dotenv/config";
import { ensureAuthenticated } from "./auth/authManager.js";
import { getAuthenticatedBroadcasterId } from "./auth/userInfo.js";
import { WsListener, resolveChatroomId } from "./chat/wsListener.js";
import { sendMessage } from "./chat/chatSender.js";
import type { ChatMessage } from "./chat/types.js";
import { logger } from "./utils/logger.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não definida no .env`);
  }
  return value;
}

function logIncomingMessage(msg: ChatMessage): void {
  logger.info(
    `[CHAT] ${msg.sender.username}: ${msg.content}`
  );
}

async function handleMessage(
  msg: ChatMessage,
  broadcasterId: number,
  botSlug: string
): Promise<void> {
  if (msg.sender.slug.toLowerCase() === botSlug.toLowerCase()) {
    return;
  }

  logIncomingMessage(msg);

  const content = msg.content.trim();
  const username = msg.sender.username;

  try {
    if (content.startsWith("!echo ")) {
      const echoText = content.slice("!echo ".length).trim();
      if (echoText) {
        await sendMessage(broadcasterId, echoText);
        logger.info(`[ECHO] Respondido: ${echoText}`);
      }
      return;
    }

    if (content === "!ping") {
      const reply = `@${username} pong! 🏓`;
      await sendMessage(broadcasterId, reply);
      logger.info(`[PING] Respondido para ${username}`);
      return;
    }

    if (content === "!auth") {
      const reply = `@${username} autenticado como ${botSlug} ✅`;
      await sendMessage(broadcasterId, reply);
      logger.info(`[AUTH] Respondido para ${username}`);
    }
  } catch (err) {
    logger.error(`Erro ao processar comando "${content}"`, err);
  }
}

async function main(): Promise<void> {
  logger.info("=== Kick Bot — OAuth + Echo MVP ===");

  const channelSlug = requireEnv("KICK_CHANNEL_SLUG");
  const botSlug = requireEnv("KICK_BOT_SLUG");

  await ensureAuthenticated();
  logger.info("Autenticação OK");

  const [chatroomId, broadcasterId] = await Promise.all([
    resolveChatroomId(channelSlug),
    getAuthenticatedBroadcasterId(),
  ]);

  const listener = new WsListener(chatroomId);

  listener.on("message", (msg: ChatMessage) => {
    void handleMessage(msg, broadcasterId, botSlug);
  });

  listener.on("connected", () => {
    logger.info("Bot online — aguardando mensagens no chat...");
    logger.info("Comandos: !echo <texto> | !ping | !auth");
  });

  listener.on("error", (err: Error) => {
    logger.error("Erro no listener WebSocket", err);
  });

  listener.connect();

  const shutdown = (): void => {
    logger.info("Encerrando bot...");
    listener.disconnect();
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
