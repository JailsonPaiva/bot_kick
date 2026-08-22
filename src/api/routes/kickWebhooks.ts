/**
 * Webhook oficial Kick — POST /api/kick/webhooks/events
 * Requer body raw (express.raw) para validação de assinatura.
 */

import { Router, type Request, type Response } from "express";
import { logger } from "../../utils/logger.js";
import {
  extractKickWebhookHeaders,
  handleKickWebhookEventFull,
  parseKickWebhookPayload,
} from "../../kick/webhookHandler.js";
import { broadcastChatMessage } from "../chatEvents.js";
import { getKickWebhookPublicKey } from "../../kick/webhookPublicKey.js";
import { verifyKickWebhookSignature } from "../../kick/webhookSignature.js";
import { loyaltyService } from "../../loyalty/loyaltyService.js";
import { claimWebhookMessage } from "../../ops/webhookIdempotency.js";
import { metrics } from "../../ops/metrics.js";
import { withRetry } from "../../ops/retry.js";
import { isModuleEnabled } from "../../ops/featureFlags.js";

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
        logger.warn("Assinatura de webhook inválida", {
          module: "webhook",
          eventType: headers.eventType,
          messageId: headers.messageId,
        });
        metrics.recordWebhook(false);
        res.status(401).json({ success: false, error: "Assinatura inválida" });
        return;
      }
    } else {
      logger.warn("Verificação de assinatura desativada", { module: "webhook" });
    }

    const claimed = await claimWebhookMessage(headers.messageId);
    if (!claimed) {
      metrics.recordWebhook(true, true);
      res.status(200).json({ success: true, ok: true, duplicate: true });
      return;
    }

    const payload = parseKickWebhookPayload(rawBody);
    if (!payload) {
      res.status(400).json({ success: false, error: "JSON inválido" });
      return;
    }

    try {
      await withRetry(async () => {
        const { chatMessage, loyaltyAward } = handleKickWebhookEventFull(
          headers,
          payload
        );
        if (chatMessage && isModuleEnabled(chatMessage.channelSlug, "chat")) {
          broadcastChatMessage(chatMessage.channelSlug, chatMessage);
        }
        if (
          loyaltyAward &&
          isModuleEnabled(loyaltyAward.channelSlug, "loyalty")
        ) {
          const result = await loyaltyService.awardForEvent(
            loyaltyAward.channelSlug,
            loyaltyAward.user,
            loyaltyAward.eventType,
            { isMember: loyaltyAward.isMember }
          );
          if (result.awarded > 0) {
            logger.info("Loyalty creditado via webhook", {
              module: "webhook",
              channelSlug: loyaltyAward.channelSlug,
              awarded: result.awarded,
              type: loyaltyAward.eventType,
              user: loyaltyAward.user.username,
            });
          }
        }
      }, { retries: 2, baseDelayMs: 50 });
      metrics.recordWebhook(true);
      res.status(200).json({ success: true, ok: true });
    } catch (err) {
      metrics.recordWebhook(false);
      logger.error("Erro ao processar evento de webhook", { module: "webhook" }, err);
      res.status(500).json({ success: false, error: "Erro interno ao processar webhook" });
    }
  });

  return router;
}
