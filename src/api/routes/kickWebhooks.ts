/**
 * Webhook oficial Kick — POST /api/kick/webhooks/events
 * Requer body raw (express.raw) para validação de assinatura.
 */

import { Router, type Request, type Response } from "express";
import { logger } from "../../utils/logger.js";
import {
  extractKickWebhookHeaders,
  handleKickWebhookEvent,
  parseKickWebhookPayload,
} from "../../kick/webhookHandler.js";
import { broadcastChatMessage } from "../chatEvents.js";
import { getKickWebhookPublicKey } from "../../kick/webhookPublicKey.js";
import { verifyKickWebhookSignature } from "../../kick/webhookSignature.js";

function isSkipVerifyEnabled(): boolean {
  return process.env.KICK_WEBHOOK_SKIP_VERIFY === "true";
}

function getRawBody(req: Request): Buffer | null {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  return null;
}

export function createKickWebhooksRouter(): Router {
  const router = Router();

  router.post("/events", async (req: Request, res: Response) => {
    const rawBody = getRawBody(req);
    if (!rawBody || rawBody.length === 0) {
      res.status(400).json({ success: false, error: "Body vazio ou inválido" });
      return;
    }

    const headers = extractKickWebhookHeaders(req);
    if (!headers) {
      res.status(400).json({
        success: false,
        error: "Headers Kick-Event-* ausentes ou inválidos",
      });
      return;
    }

    if (!isSkipVerifyEnabled()) {
      const publicKey = await getKickWebhookPublicKey();
      const valid = verifyKickWebhookSignature(
        publicKey,
        headers.messageId,
        headers.timestamp,
        rawBody,
        headers.signature
      );

      if (!valid) {
        logger.warn(
          `[WEBHOOK] Assinatura inválida type=${headers.eventType} msgId=${headers.messageId}`
        );
        res.status(401).json({ success: false, error: "Assinatura inválida" });
        return;
      }
    } else {
      logger.warn("[WEBHOOK] KICK_WEBHOOK_SKIP_VERIFY=true — assinatura não verificada");
    }

    const payload = parseKickWebhookPayload(rawBody);
    if (!payload) {
      res.status(400).json({ success: false, error: "JSON inválido" });
      return;
    }

    try {
      const liveMessage = handleKickWebhookEvent(headers, payload);
      if (liveMessage) {
        broadcastChatMessage(liveMessage.channelSlug, liveMessage);
      }
      res.status(200).json({ success: true, ok: true });
    } catch (err) {
      logger.error("[WEBHOOK] Erro ao processar evento", err);
      res.status(500).json({ success: false, error: "Erro interno ao processar webhook" });
    }
  });

  return router;
}
