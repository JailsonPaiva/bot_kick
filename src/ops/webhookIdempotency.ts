/**
 * Idempotência de webhooks Kick via messageId (memória + Redis opcional).
 */

import { redis } from "../infra/redis/redisClient.js";

const seen = new Map<string, number>();
const TTL_MS = 24 * 60 * 60 * 1000;

function gc(now = Date.now()): void {
  for (const [id, ts] of seen.entries()) {
    if (now - ts > TTL_MS) seen.delete(id);
  }
}

export async function claimWebhookMessage(messageId: string): Promise<boolean> {
  gc();
  if (seen.has(messageId)) return false;
  seen.set(messageId, Date.now());

  try {
    if (redis.status === "ready") {
      const key = `webhook:seen:${messageId}`;
      const ok = await redis.set(key, "1", "PX", TTL_MS, "NX");
      if (ok !== "OK") return false;
    }
  } catch {
    // Redis opcional — memória local já marcou
  }
  return true;
}

export function __resetWebhookIdempotencyForTests(): void {
  seen.clear();
}
