/**
 * Validação de assinatura de webhooks Kick (RSA-SHA256).
 * Payload assinado: `{messageId}.{timestamp}.{rawBody}`
 * @see https://docs.kick.com/events/webhook-security
 */

import crypto from "node:crypto";

export function buildKickWebhookSignaturePayload(
  messageId: string,
  timestamp: string,
  rawBody: string | Buffer
): string {
  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  return `${messageId}.${timestamp}.${body}`;
}

export function verifyKickWebhookSignature(
  publicKeyPem: string,
  messageId: string,
  timestamp: string,
  rawBody: string | Buffer,
  signatureBase64: string
): boolean {
  if (!messageId || !timestamp || !signatureBase64) {
    return false;
  }

  try {
    const payload = buildKickWebhookSignaturePayload(messageId, timestamp, rawBody);
    const signature = Buffer.from(signatureBase64, "base64");
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(payload);
    verifier.end();
    return verifier.verify(publicKeyPem, signature);
  } catch {
    return false;
  }
}
