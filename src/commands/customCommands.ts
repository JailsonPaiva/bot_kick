/**
 * Serviço de comandos customizáveis — executa comandos criados pelo streamer via dashboard.
 *
 * Variáveis suportadas nas respostas:
 *   {user}    → username de quem acionou o comando
 *   {count}   → quantas vezes o comando já foi usado
 *   {date}    → data atual no formato dd/mm/yyyy
 *   {uptime}  → tempo desde que o bot foi iniciado
 */

import { prisma } from "../infra/prisma/client.js";
import { sendMessage } from "../chat/chatSender.js";
import { logger } from "../utils/logger.js";
import type { ChatMessage } from "../chat/types.js";

export type PermissionLevel = "everyone" | "subscribers" | "moderators" | "broadcaster";

const BOT_START_TIME = Date.now();

/** Mapa: `commandId` → timestamp da última execução (cooldown global por comando) */
const globalCooldowns = new Map<string, number>();
/** Mapa: `commandId:userId` → timestamp da última execução (cooldown por usuário) */
const userCooldowns = new Map<string, number>();

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${s}s`;
  return `${s}s`;
}

function substituteVariables(
  template: string,
  username: string,
  usageCount: number
): string {
  const now = new Date();
  const date = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
  const uptime = formatUptime(Date.now() - BOT_START_TIME);

  return template
    .replace(/\{user\}/gi, `@${username}`)
    .replace(/\{count\}/gi, String(usageCount + 1))
    .replace(/\{date\}/gi, date)
    .replace(/\{uptime\}/gi, uptime);
}

function hasPermission(msg: ChatMessage, required: PermissionLevel): boolean {
  if (required === "everyone") return true;

  const badges = msg.sender.identity.badges.map((b) => b.type.toLowerCase());

  if (required === "subscribers") {
    return badges.some((b) => b === "subscriber" || b === "broadcaster");
  }
  if (required === "moderators") {
    return badges.some((b) => b === "moderator" || b === "broadcaster");
  }
  if (required === "broadcaster") {
    return badges.includes("broadcaster");
  }
  return false;
}

function isOnCooldown(commandId: string, userId: number, cooldownSeconds: number): boolean {
  if (cooldownSeconds <= 0) return false;

  const now = Date.now();
  const globalKey = commandId;
  const userKey = `${commandId}:${userId}`;

  const globalLast = globalCooldowns.get(globalKey) ?? 0;
  const userLast = userCooldowns.get(userKey) ?? 0;

  const elapsed = Math.min(now - globalLast, now - userLast);
  return elapsed < cooldownSeconds * 1000;
}

function setCooldown(commandId: string, userId: number): void {
  const now = Date.now();
  globalCooldowns.set(commandId, now);
  userCooldowns.set(`${commandId}:${userId}`, now);
}

/**
 * Tenta executar um comando customizado pelo trigger.
 * Retorna `true` se o comando foi encontrado e executado (ou silenciado por cooldown/permissão).
 */
export async function tryExecuteCustomCommand(
  trigger: string,
  channelSlug: string,
  msg: ChatMessage,
  broadcasterId: number
): Promise<boolean> {
  const normalized = trigger.toLowerCase();

  const command = await prisma.command.findFirst({
    where: {
      channelSlug,
      isActive: true,
      OR: [
        { trigger: normalized },
        { aliases: { has: normalized } },
      ],
    },
  });

  if (!command) return false;

  if (!hasPermission(msg, command.permission as PermissionLevel)) {
    logger.debug(`[CMD] ${msg.sender.username} sem permissão para !${trigger}`);
    return true;
  }

  if (isOnCooldown(command.id, msg.sender.id, command.cooldown)) {
    logger.debug(`[CMD] !${trigger} em cooldown para ${msg.sender.username}`);
    return true;
  }

  const response = substituteVariables(
    command.response,
    msg.sender.username,
    command.usageCount
  );

  setCooldown(command.id, msg.sender.id);

  await Promise.all([
    sendMessage(broadcasterId, response),
    prisma.command.update({
      where: { id: command.id },
      data: { usageCount: { increment: 1 } },
    }),
  ]);

  logger.info(`[CMD] !${trigger} executado por ${msg.sender.username}`);
  return true;
}
