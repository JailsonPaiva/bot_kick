export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export function backoffDelay(
  attempt: number,
  baseDelayMs = 100,
  maxDelayMs = 5_000
): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * Math.min(50, exp / 4));
  return exp + jitter;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 5_000;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const wait = backoffDelay(attempt, baseDelayMs, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}
