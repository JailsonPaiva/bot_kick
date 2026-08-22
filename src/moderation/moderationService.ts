/**
 * Serviço de moderação — filtra mensagens com base em regras configuradas por canal.
 *
 * Filtros disponíveis:
 *   - Links     — bloqueia URLs fora da whitelist
 *   - Caps      — bloqueia mensagens com excesso de maiúsculas
 *   - Spam      — bloqueia mensagens repetidas em sequência
 *   - Palavras  — bloqueia termos proibidos configurados pelo streamer
 */

import { prisma } from "../infra/prisma/client.js";
import { sendMessage } from "../chat/chatSender.js";
import { banKickUser, deleteKickChatMessage } from "../kick/chatModerationApi.js";
import { logger } from "../utils/logger.js";
import type { ChatMessage } from "../chat/types.js";

export interface ModerationResult {
  blocked: boolean;
  reason?: string;
}

export interface ModerationConfigEntity {
  linksEnabled: boolean;
  linksWhitelist: string[];
  linksActionType?: string;
  linksTimeoutDurationMinutes?: number;
  capsEnabled: boolean;
  capsPercent: number;
  capsActionType?: string;
  capsTimeoutDurationMinutes?: number;
  spamEnabled: boolean;
  spamWindow: number;
  spamActionType?: string;
  spamTimeoutDurationMinutes?: number;
  bannedWords: string[];
  bannedActionType?: string;
  bannedTimeoutDurationMinutes?: number;
  actionType: string;
  timeoutDurationMinutes: number;
}

interface ModerationDeps {
  getConfig: (channelSlug: string) => Promise<ModerationConfigEntity | null>;
  logViolation: (
    channelSlug: string,
    msg: ChatMessage,
    reason: string,
    action: string
  ) => Promise<void>;
  send: (broadcasterId: number, content: string) => Promise<void>;
  applyTimeout?: (
    broadcasterId: number,
    userId: number,
    durationMinutes: number,
    reason: string
  ) => Promise<void>;
  deleteMessage?: (messageId: string) => Promise<void>;
}

/** Cache do config por canal para evitar query por mensagem */
const configCache = new Map<
  string,
  {
    data: Awaited<ReturnType<typeof loadConfig>>;
    loadedAt: number;
  }
>();
const CONFIG_TTL_MS = 60_000;

/** Últimas N mensagens por usuário para detecção de spam */
const recentMessages = new Map<string, string[]>();
const SPAM_HISTORY = 3;

/** URL regex simples */
const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+|\b\w+\.\w{2,}\/\S*/gi;

const DEFAULT_TIMEOUT_MINUTES = 1;
const MIN_TIMEOUT_MINUTES = 1;
const MAX_TIMEOUT_MINUTES = 10_080; // 7 dias
const DEFAULT_ACTION_TYPE = "warn";
const VALID_ACTIONS = new Set(["warn", "delete", "timeout"]);
type ModerationFilter = "links" | "caps" | "spam" | "banned";

export function clampTimeoutDurationMinutes(value: unknown): number {
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return DEFAULT_TIMEOUT_MINUTES;
  }
  return Math.min(MAX_TIMEOUT_MINUTES, Math.max(MIN_TIMEOUT_MINUTES, n));
}

function normalizeActionType(actionType: unknown): "warn" | "delete" | "timeout" {
  const action =
    typeof actionType === "string" ? actionType.trim().toLowerCase() : "";
  if (VALID_ACTIONS.has(action)) {
    return action as "warn" | "delete" | "timeout";
  }
  return DEFAULT_ACTION_TYPE;
}

function getFilterPenalty(
  config: ModerationConfigEntity,
  filter: ModerationFilter
): { action: "warn" | "delete" | "timeout"; timeoutMinutes: number } {
  const fallbackAction = normalizeActionType(config.actionType);
  const fallbackTimeout = clampTimeoutDurationMinutes(
    config.timeoutDurationMinutes ?? DEFAULT_TIMEOUT_MINUTES
  );

  if (filter === "links") {
    return {
      action: normalizeActionType(config.linksActionType ?? fallbackAction),
      timeoutMinutes: clampTimeoutDurationMinutes(
        config.linksTimeoutDurationMinutes ?? fallbackTimeout
      ),
    };
  }

  if (filter === "caps") {
    return {
      action: normalizeActionType(config.capsActionType ?? fallbackAction),
      timeoutMinutes: clampTimeoutDurationMinutes(
        config.capsTimeoutDurationMinutes ?? fallbackTimeout
      ),
    };
  }

  if (filter === "spam") {
    return {
      action: normalizeActionType(config.spamActionType ?? fallbackAction),
      timeoutMinutes: clampTimeoutDurationMinutes(
        config.spamTimeoutDurationMinutes ?? fallbackTimeout
      ),
    };
  }

  return {
    action: normalizeActionType(config.bannedActionType ?? fallbackAction),
    timeoutMinutes: clampTimeoutDurationMinutes(
      config.bannedTimeoutDurationMinutes ?? fallbackTimeout
    ),
  };
}

async function loadConfig(channelSlug: string) {
  return prisma.moderationConfig.findUnique({ where: { channelSlug } });
}

async function getConfig(channelSlug: string) {
  const cached = configCache.get(channelSlug);
  if (cached && Date.now() - cached.loadedAt < CONFIG_TTL_MS) {
    return cached.data;
  }
  const data = await loadConfig(channelSlug);
  configCache.set(channelSlug, { data, loadedAt: Date.now() });
  return data;
}

export function invalidateModerationCache(channelSlug: string): void {
  configCache.delete(channelSlug);
}
export function __resetModerationStateForTests(): void {
  configCache.clear();
  recentMessages.clear();
}

function isModerator(msg: ChatMessage): boolean {
  return msg.sender.identity.badges.some(
    (b) => b.type === "moderator" || b.type === "broadcaster"
  );
}

function checkLinks(content: string, whitelist: string[]): boolean {
  const matches = content.match(URL_REGEX);
  if (!matches) return false;
  for (const url of matches) {
    const isAllowed = whitelist.some((domain) =>
      url.toLowerCase().includes(domain.toLowerCase())
    );
    if (!isAllowed) return true;
  }
  return false;
}

function checkCaps(content: string, maxPercent: number): boolean {
  const letters = content.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 6) return false;
  const uppers = letters.replace(/[^A-Z]/g, "").length;
  return (uppers / letters.length) * 100 > maxPercent;
}

function checkSpam(userId: number, content: string, windowSize: number): boolean {
  const key = String(userId);
  const history = recentMessages.get(key) ?? [];
  const trimmed = content.trim().toLowerCase();

  const isDuplicate =
    history.length >= windowSize &&
    history.slice(-windowSize).every((m) => m === trimmed);

  const updated = [...history.slice(-(SPAM_HISTORY - 1)), trimmed];
  recentMessages.set(key, updated);

  return isDuplicate;
}

function checkBannedWords(content: string, words: string[]): boolean {
  if (words.length === 0) return false;
  const lower = content.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

async function logViolation(
  channelSlug: string,
  msg: ChatMessage,
  reason: string,
  action: string
): Promise<void> {
  await prisma.moderationLog.create({
    data: {
      channelSlug,
      userId: msg.sender.id,
      username: msg.sender.username,
      messageId: msg.id,
      content: msg.content.slice(0, 500),
      reason,
      action,
    },
  });
}

const defaultDeps: ModerationDeps = {
  getConfig,
  logViolation,
  send: sendMessage,
  applyTimeout: async (broadcasterId, userId, durationMinutes, reason) => {
    await banKickUser({
      broadcasterUserId: broadcasterId,
      userId,
      durationMinutes,
      reason,
    });
  },
  deleteMessage: deleteKickChatMessage,
};

export async function checkModeration(
  msg: ChatMessage,
  channelSlug: string,
  broadcasterId: number,
  deps: ModerationDeps = defaultDeps
): Promise<ModerationResult> {
  const config = await deps.getConfig(channelSlug);
  if (!config) return { blocked: false };

  if (isModerator(msg)) return { blocked: false };

  const content = msg.content;
  let reason: string | null = null;
  let triggeredFilter: ModerationFilter | null = null;

  if (config.linksEnabled && checkLinks(content, config.linksWhitelist)) {
    reason = "link não permitido";
    triggeredFilter = "links";
  } else if (config.capsEnabled && checkCaps(content, config.capsPercent)) {
    reason = `excesso de maiúsculas (>${config.capsPercent}%)`;
    triggeredFilter = "caps";
  } else if (
    config.spamEnabled &&
    checkSpam(msg.sender.id, content, config.spamWindow)
  ) {
    reason = "spam detectado";
    triggeredFilter = "spam";
  } else if (checkBannedWords(content, config.bannedWords)) {
    reason = "palavra proibida";
    triggeredFilter = "banned";
  }

  if (!reason || !triggeredFilter) return { blocked: false };

  const { action, timeoutMinutes } = getFilterPenalty(config, triggeredFilter);

  logger.warn(
    `[MOD] ${msg.sender.username} — ${reason} (ação: ${action}${
      action === "timeout" ? `, ${timeoutMinutes}min` : ""
    })`
  );

  void deps.logViolation(
    channelSlug,
    msg,
    reason,
    action === "timeout" ? `timeout:${timeoutMinutes}m` : action
  );

  if (action === "delete" && deps.deleteMessage) {
    try {
      await deps.deleteMessage(msg.id);
    } catch (err) {
      logger.error(`[MOD] Falha ao deletar mensagem ${msg.id}`, err);
    }
  }

  if (action === "timeout" && deps.applyTimeout) {
    try {
      await deps.applyTimeout(
        broadcasterId,
        msg.sender.id,
        timeoutMinutes,
        reason
      );
    } catch (err) {
      logger.error(
        `[MOD] Falha ao aplicar timeout em ${msg.sender.username}`,
        err
      );
    }
  }

  if (action === "warn" || action === "timeout") {
    const timeoutHint =
      action === "timeout" ? ` Timeout: ${timeoutMinutes} min.` : "";
    await deps.send(
      broadcasterId,
      `@${msg.sender.username} ⚠️ Mensagem removida: ${reason}.${timeoutHint}`
    );
  }

  return { blocked: true, reason };
}
