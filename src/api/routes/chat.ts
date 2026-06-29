/**
 * Proxy REST para envio de mensagens no chat Kick (Parte 8).
 */

import { Router } from "express";
import { authMiddleware } from "../auth.js";
import type { ApiResponse } from "../types.js";
import { logger } from "../../utils/logger.js";
import { parseSendChatBody } from "../../chat/chatMessageValidation.js";
import { sendMessage } from "../../chat/chatSender.js";
import { getAuthenticatedBroadcasterId } from "../../auth/userInfo.js";
import { fetchBroadcasterUserId } from "../../chat/channelInfo.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export interface ChatRouterDeps {
  sendMessage: typeof sendMessage;
  getAuthenticatedBroadcasterId: typeof getAuthenticatedBroadcasterId;
  fetchBroadcasterUserId: typeof fetchBroadcasterUserId;
}

const defaultDeps: ChatRouterDeps = {
  sendMessage,
  getAuthenticatedBroadcasterId,
  fetchBroadcasterUserId,
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
      const message = err instanceof Error ? err.message : String(err);
      logger.error("[CHAT] Falha ao enviar mensagem via dashboard", err);
      res.status(502).json({ success: false, error: message } satisfies ApiResponse);
    }
  });

  return router;
}
