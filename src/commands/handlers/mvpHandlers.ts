/**
 * Handlers dos comandos MVP: !echo, !ping, !auth
 */

import { sendMessage } from "../../chat/chatSender.js";
import { logger } from "../../utils/logger.js";
import type { CommandHandler } from "../types.js";

export const handleEcho: CommandHandler = async (parsed, ctx) => {
  const echoText = parsed.rawArgs.trim();
  if (!echoText) {
    return;
  }

  await sendMessage(ctx.broadcasterId, echoText);
  logger.info(`[ECHO] Respondido: ${echoText}`);
};

export const handlePing: CommandHandler = async (_parsed, ctx) => {
  const username = ctx.message.sender.username;
  const reply = `@${username} pong! 🏓`;

  await sendMessage(ctx.broadcasterId, reply);
  logger.info(`[PING] Respondido para ${username}`);
};

export const handleAuth: CommandHandler = async (_parsed, ctx) => {
  const username = ctx.message.sender.username;
  const reply = `@${username} autenticado como ${ctx.botSlug} ✅`;

  await sendMessage(ctx.broadcasterId, reply);
  logger.info(`[AUTH] Respondido para ${username}`);
};
