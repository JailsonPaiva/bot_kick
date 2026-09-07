import { prisma } from "../infra/prisma/client.js";
import { redis } from "../infra/redis/redisClient.js";
import { runtimeHealth } from "./runtimeHealth.js";
import { APP_VERSION } from "./appVersion.js";

export interface DependencyHealth {
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  detail?: string;
}

export interface DeepHealth {
  status: "ok" | "degraded" | "down";
  version: string;
  timestamp: string;
  dependencies: {
    database: DependencyHealth;
    redis: DependencyHealth;
    websocket: DependencyHealth;
    queue: DependencyHealth;
  };
}

async function checkDatabase(): Promise<DependencyHealth> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - t0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRedis(): Promise<DependencyHealth> {
  const t0 = Date.now();
  try {
    if (redis.status !== "ready") {
      return { status: "degraded", latencyMs: Date.now() - t0, detail: redis.status };
    }
    const pong = await redis.ping();
    return {
      status: pong === "PONG" ? "ok" : "degraded",
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      status: "degraded",
      latencyMs: Date.now() - t0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function collectDeepHealth(): Promise<DeepHealth> {
  const [database, redisHealth] = await Promise.all([checkDatabase(), checkRedis()]);
  const ws = runtimeHealth.getWs();
  const websocket: DependencyHealth = {
    status: ws.state === "connected" ? "ok" : ws.state === "connecting" ? "degraded" : "down",
    detail: ws.lastError ?? ws.state,
  };
  const queue: DependencyHealth = {
    status: runtimeHealth.getQueueDepth() > 100 ? "degraded" : "ok",
    detail: `depth=${runtimeHealth.getQueueDepth()}`,
  };

  // Em modo API-only (sem KICK_CHANNEL_SLUG), WebSocket down é esperado e não afeta status geral
  const apiOnlyMode = !process.env.KICK_CHANNEL_SLUG || !process.env.KICK_BOT_SLUG;
  const criticalParts = apiOnlyMode 
    ? [database.status, redisHealth.status, queue.status]
    : [database.status, redisHealth.status, websocket.status, queue.status];
  
  const status: DeepHealth["status"] = criticalParts.includes("down")
    ? "down"
    : criticalParts.includes("degraded")
      ? "degraded"
      : "ok";

  return {
    status,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    dependencies: {
      database,
      redis: redisHealth,
      websocket,
      queue,
    },
  };
}
