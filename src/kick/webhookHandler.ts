/**
 * Processamento de eventos webhook Kick após validação de assinatura.
 */

import type { Request } from "express";
import { logger } from "../utils/logger.js";
import type {
  KickChatMessageSentPayload,
  KickWebhookHeaders,
  KickWebhookPayload,
} from "./webhookTypes.js";

export function extractKickWebhookHeaders(req: Request): KickWebhookHeaders | null {
  const messageId = req.headers["kick-event-message-id"];
  const signature = req.headers["kick-event-signature"];
  const timestamp = req.headers["kick-event-message-timestamp"];
  const eventType = req.headers["kick-event-type"];
  const eventVersion = req.headers["kick-event-version"];
  const subscriptionId = req.headers["kick-event-subscription-id"];

  if (
    typeof messageId !== "string" ||
    typeof signature !== "string" ||
    typeof timestamp !== "string" ||
    typeof eventType !== "string" ||
    typeof eventVersion !== "string"
  ) {
    return null;
  }

  return {
    messageId,
    signature,
    timestamp,
    eventType,
    eventVersion,
    subscriptionId: typeof subscriptionId === "string" ? subscriptionId : undefined,
  };
}

export function parseKickWebhookPayload(rawBody: Buffer): KickWebhookPayload | null {
  try {
    return JSON.parse(rawBody.toString("utf8")) as KickWebhookPayload;
  } catch {
    return null;
  }
}

function handleChatMessageSent(payload: KickChatMessageSentPayload): void {
  const sender = payload.sender?.username ?? "?";
  const content = (payload.content ?? "").slice(0, 200);

  logger.info("[WEBHOOK] chat.message.sent");
  logger.info(`  message_id: ${payload.message_id}`);
  logger.info(`  sender: ${sender}`);
  logger.info(`  content: "${content}"`);
}

export function handleKickWebhookEvent(
  headers: KickWebhookHeaders,
  payload: KickWebhookPayload
): void {
  logger.info(
    `[WEBHOOK] ${headers.eventType} v${headers.eventVersion} msgId=${headers.messageId}`
  );

  switch (headers.eventType) {
    case "chat.message.sent":
      handleChatMessageSent(payload as KickChatMessageSentPayload);
      break;
    default:
      logger.debug(`[WEBHOOK] Evento não tratado: ${headers.eventType}`);
  }
}
