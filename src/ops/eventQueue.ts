/**
 * Fila in-process de eventos críticos com retry/backoff.
 */

import { logger } from "../utils/logger.js";
import { metrics } from "./metrics.js";
import { runtimeHealth } from "./runtimeHealth.js";
import { withRetry } from "./retry.js";

export type CriticalEventName =
  | "webhook"
  | "alert"
  | "loyalty"
  | "chat_broadcast";

export interface QueuedEvent<T = unknown> {
  id: string;
  name: CriticalEventName;
  payload: T;
  enqueuedAt: number;
}

type Handler = (event: QueuedEvent) => Promise<void>;

const handlers = new Map<CriticalEventName, Handler>();
const queue: QueuedEvent[] = [];
let pumping = false;

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      const event = queue.shift();
      if (!event) break;
      runtimeHealth.setQueueDepth(queue.length);
      const handler = handlers.get(event.name);
      if (!handler) {
        logger.warn("Evento sem handler", { module: "queue", name: event.name });
        metrics.recordQueue(false);
        continue;
      }
      try {
        await withRetry(() => handler(event), { retries: 2, baseDelayMs: 50 });
        metrics.recordQueue(true);
      } catch (err) {
        metrics.recordQueue(false);
        logger.error("Falha ao processar evento da fila", {
          module: "queue",
          name: event.name,
          eventId: event.id,
        }, err);
      }
    }
  } finally {
    pumping = false;
    runtimeHealth.setQueueDepth(queue.length);
  }
}

export const eventQueue = {
  register(name: CriticalEventName, handler: Handler): void {
    handlers.set(name, handler);
  },

  enqueue<T>(name: CriticalEventName, payload: T): string {
    const event: QueuedEvent<T> = {
      id: nextId(),
      name,
      payload,
      enqueuedAt: Date.now(),
    };
    queue.push(event as QueuedEvent);
    runtimeHealth.setQueueDepth(queue.length);
    void pump();
    return event.id;
  },

  size(): number {
    return queue.length;
  },
};
