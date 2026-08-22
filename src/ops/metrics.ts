/**
 * Métricas in-process para o piloto (API, websocket, webhooks, comandos).
 */

export interface LatencyBucket {
  count: number;
  totalMs: number;
  maxMs: number;
  samples: number[];
}

const MAX_SAMPLES = 500;

function emptyBucket(): LatencyBucket {
  return { count: 0, totalMs: 0, maxMs: 0, samples: [] };
}

const apiRoutes = new Map<string, { ok: number; err: number; latency: LatencyBucket }>();
let websocketReconnects = 0;
let websocketConnected = false;
let webhookOk = 0;
let webhookErr = 0;
let webhookDup = 0;
let commandsProcessed = 0;
let queueProcessed = 0;
let queueFailed = 0;
const startedAt = Date.now();

function recordLatency(bucket: LatencyBucket, ms: number): void {
  bucket.count += 1;
  bucket.totalMs += ms;
  bucket.maxMs = Math.max(bucket.maxMs, ms);
  bucket.samples.push(ms);
  if (bucket.samples.length > MAX_SAMPLES) {
    bucket.samples.shift();
  }
}

function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? 0;
}

export const metrics = {
  recordApi(method: string, path: string, status: number, durationMs: number): void {
    const key = `${method} ${path}`;
    const row = apiRoutes.get(key) ?? { ok: 0, err: 0, latency: emptyBucket() };
    if (status >= 500) row.err += 1;
    else row.ok += 1;
    recordLatency(row.latency, durationMs);
    apiRoutes.set(key, row);
  },

  recordWsReconnect(): void {
    websocketReconnects += 1;
  },

  setWsConnected(value: boolean): void {
    websocketConnected = value;
  },

  recordWebhook(ok: boolean, duplicate = false): void {
    if (duplicate) webhookDup += 1;
    else if (ok) webhookOk += 1;
    else webhookErr += 1;
  },

  recordCommand(): void {
    commandsProcessed += 1;
  },

  recordQueue(ok: boolean): void {
    if (ok) queueProcessed += 1;
    else queueFailed += 1;
  },

  snapshot() {
    const routes: Record<
      string,
      { ok: number; err: number; p95Ms: number; maxMs: number }
    > = {};
    for (const [key, row] of apiRoutes.entries()) {
      routes[key] = {
        ok: row.ok,
        err: row.err,
        p95Ms: percentile(row.latency.samples, 95),
        maxMs: row.latency.maxMs,
      };
    }
    return {
      uptimeMs: Date.now() - startedAt,
      api: routes,
      websocket: {
        connected: websocketConnected,
        reconnects: websocketReconnects,
      },
      webhooks: { ok: webhookOk, err: webhookErr, duplicate: webhookDup },
      commandsProcessed,
      queue: { processed: queueProcessed, failed: queueFailed },
    };
  },
};

export function getStartedAt(): number {
  return startedAt;
}
