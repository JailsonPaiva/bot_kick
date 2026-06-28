import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
});

export async function connectRedis(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") {
    return;
  }

  await redis.connect();
}

export async function closeRedis(): Promise<void> {
  if (redis.status === "end") {
    return;
  }

  await redis.quit();
}
