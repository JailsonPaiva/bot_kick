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
interface CommandEntity {
  id: string;
  response: string;
  usageCount: number;
  permission: string;
  cooldown: number;
}
interface CommandDeps {
  findCommand: (trigger: string, channelSlug: string) => Promise<CommandEntity | null>;
  incrementUsage: (commandId: string) => Promise<void>;
  send: (broadcasterId: number, response: string) => Promise<void>;
  now: () => number;
}

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
  usageCount: number,
  nowMs: number
): string {
  const now = new Date(nowMs);
  const date = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
  const uptime = formatUptime(nowMs - BOT_START_TIME);

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

function isOnCooldown(
  commandId: string,
  userId: number,
  cooldownSeconds: number,
  nowMs: number
): boolean {
  if (cooldownSeconds <= 0) return false;

  const globalKey = commandId;
  const userKey = `${commandId}:${userId}`;
  const hasGlobal = globalCooldowns.has(globalKey);
  const hasUser = userCooldowns.has(userKey);
  if (!hasGlobal && !hasUser) return false;

  const globalLast = globalCooldowns.get(globalKey) ?? 0;
  const userLast = userCooldowns.get(userKey) ?? 0;

  const elapsed = Math.min(nowMs - globalLast, nowMs - userLast);
  return elapsed < cooldownSeconds * 1000;
}

function setCooldown(commandId: string, userId: number, nowMs: number): void {
  globalCooldowns.set(commandId, nowMs);
  userCooldowns.set(`${commandId}:${userId}`, nowMs);
}

const defaultDeps: CommandDeps = {
  findCommand: async (trigger, channelSlug) =>
    prisma.command.findFirst({
      where: {
        channelSlug,
        isActive: true,
        OR: [{ trigger }, { aliases: { has: trigger } }],
      },
    }),
  incrementUsage: async (commandId) => {
    await prisma.command.update({
      where: { id: commandId },
      data: { usageCount: { increment: 1 } },
    });
  },
  send: sendMessage,
  now: () => Date.now(),
};

export function __resetCustomCommandStateForTests(): void {
  globalCooldowns.clear();
  userCooldowns.clear();
}

/**
 * Tenta executar um comando customizado pelo trigger.
 * Retorna `true` se o comando foi encontrado e executado (ou silenciado por cooldown/permissão).
 */
export async function tryExecuteCustomCommand(
  trigger: string,
  channelSlug: string,
  msg: ChatMessage,
  broadcasterId: number,
  deps: CommandDeps = defaultDeps
): Promise<boolean> {
  const normalized = trigger.toLowerCase();
  const nowMs = deps.now();
  const command = await deps.findCommand(normalized, channelSlug);

  if (!command) return false;

  if (!hasPermission(msg, command.permission as PermissionLevel)) {
    logger.debug(`[CMD] ${msg.sender.username} sem permissão para !${trigger}`);
    return true;
  }

  if (isOnCooldown(command.id, msg.sender.id, command.cooldown, nowMs)) {
    logger.debug(`[CMD] !${trigger} em cooldown para ${msg.sender.username}`);
    return true;
  }

  const response = substituteVariables(
    command.response,
    msg.sender.username,
    command.usageCount,
    nowMs
  );

  setCooldown(command.id, msg.sender.id, nowMs);

  await Promise.all([
    deps.send(broadcasterId, response),
    deps.incrementUsage(command.id),
  ]);

  logger.info(`[CMD] !${trigger} executado por ${msg.sender.username}`);
  return true;
}
