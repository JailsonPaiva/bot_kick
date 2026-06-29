/**
 * Proxy REST para chat Kick — envio (Parte 8) e moderação (Parte 9).
 */

import { Router } from "express";
import { authMiddleware } from "../auth.js";
import type { ApiResponse } from "../types.js";
import { logger } from "../../utils/logger.js";
import { parseSendChatBody } from "../../chat/chatMessageValidation.js";
import {
  parseBanUserBody,
  parseUnbanUserBody,
  validateChatMessageIdParam,
} from "../../chat/chatModerationValidation.js";
import { sendMessage } from "../../chat/chatSender.js";
import { getAuthenticatedBroadcasterId } from "../../auth/userInfo.js";
import { fetchBroadcasterUserId } from "../../chat/channelInfo.js";
import {
  banKickUser,
  deleteKickChatMessage,
  unbanKickUser,
} from "../../kick/chatModerationApi.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export interface ChatRouterDeps {
  sendMessage: typeof sendMessage;
  getAuthenticatedBroadcasterId: typeof getAuthenticatedBroadcasterId;
  fetchBroadcasterUserId: typeof fetchBroadcasterUserId;
  deleteKickChatMessage: typeof deleteKickChatMessage;
  banKickUser: typeof banKickUser;
  unbanKickUser: typeof unbanKickUser;
}

const defaultDeps: ChatRouterDeps = {
  sendMessage,
  getAuthenticatedBroadcasterId,
  fetchBroadcasterUserId,
  deleteKickChatMessage,
  banKickUser,
  unbanKickUser,
};

async function resolveBroadcasterId(
  channelSlug: string | undefined,
  deps: ChatRouterDeps
): Promise<number> {
  const slug = channelSlug ?? DEFAULT_CHANNEL;
  if (slug) {
    return deps.fetchBroadcasterUserId(slug);
  }
  return deps.getAuthenticatedBroadcasterId();
}

function handleKickProxyError(
  res: import("express").Response,
  err: unknown,
  logLabel: string
): void {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[CHAT] ${logLabel}`, err);
  res.status(502).json({ success: false, error: message } satisfies ApiResponse);
}

export function createChatRouter(deps: ChatRouterDeps = defaultDeps): Router {
  const router = Router();

  router.post("/chat/send", authMiddleware, async (req, res) => {
    const parsed = parseSendChatBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ success: false, error: parsed.error } satisfies ApiResponse);
      return;
    }

    try {
      const broadcasterId = await resolveBroadcasterId(parsed.channelSlug, deps);

      await deps.sendMessage(broadcasterId, parsed.content, {
        useBotPrefix: false,
      });

      logger.info(
        `[CHAT] Mensagem enviada via dashboard (${parsed.content.length} chars)`
      );

      res.json({
        success: true,
        message: "Mensagem enviada",
        data: {
          broadcasterUserId: broadcasterId,
          channelSlug: (parsed.channelSlug ?? DEFAULT_CHANNEL) || undefined,
        },
      } satisfies ApiResponse);
    } catch (err) {
      handleKickProxyError(res, err, "Falha ao enviar mensagem via dashboard");
    }
  });

  router.post("/chat/moderation/ban", authMiddleware, async (req, res) => {
    const parsed = parseBanUserBody(req.body ?? {});
    if (!parsed.ok) {
      res.status(400).json({ success: false, error: parsed.error } satisfies ApiResponse);
      return;
    }

    try {
      const broadcasterId = await resolveBroadcasterId(parsed.value.channelSlug, deps);

      await deps.banKickUser({
        broadcasterUserId: broadcasterId,
        userId: parsed.value.userId,
        durationMinutes: parsed.value.durationMinutes,
        reason: parsed.value.reason,
      });

      const action = parsed.value.durationMinutes ? "timeout" : "ban";
      logger.info(
        `[CHAT] ${action} aplicado userId=${parsed.value.userId} broadcaster=${broadcasterId}`
      );

      res.json({
        success: true,
        message: parsed.value.durationMinutes
          ? "Timeout aplicado"
          : "Ban aplicado",
        data: {
          broadcasterUserId: broadcasterId,
          userId: parsed.value.userId,
          durationMinutes: parsed.value.durationMinutes ?? null,
        },
      } satisfies ApiResponse);
    } catch (err) {
      handleKickProxyError(res, err, "Falha ao banir/timeout via dashboard");
    }
  });

  router.delete("/chat/moderation/ban", authMiddleware, async (req, res) => {
    const parsed = parseUnbanUserBody(req.body ?? {});
    if (!parsed.ok) {
      res.status(400).json({ success: false, error: parsed.error } satisfies ApiResponse);
      return;
    }

    try {
      const broadcasterId = await resolveBroadcasterId(parsed.value.channelSlug, deps);

      await deps.unbanKickUser({
        broadcasterUserId: broadcasterId,
        userId: parsed.value.userId,
      });

      logger.info(
        `[CHAT] ban/timeout removido userId=${parsed.value.userId} broadcaster=${broadcasterId}`
      );

      res.json({
        success: true,
        message: "Ban/timeout removido",
        data: {
          broadcasterUserId: broadcasterId,
          userId: parsed.value.userId,
        },
      } satisfies ApiResponse);
    } catch (err) {
      handleKickProxyError(res, err, "Falha ao remover ban/timeout via dashboard");
    }
  });

  router.delete("/chat/:messageId", authMiddleware, async (req, res) => {
    const parsed = validateChatMessageIdParam(req.params.messageId);
    if (!parsed.ok) {
      res.status(400).json({ success: false, error: parsed.error } satisfies ApiResponse);
      return;
    }

    try {
      await deps.deleteKickChatMessage(parsed.messageId);
      logger.info(`[CHAT] Mensagem apagada messageId=${parsed.messageId}`);

      res.json({
        success: true,
        message: "Mensagem apagada",
        data: { messageId: parsed.messageId },
      } satisfies ApiResponse);
    } catch (err) {
      handleKickProxyError(res, err, "Falha ao apagar mensagem via dashboard");
    }
  });

  return router;
}
