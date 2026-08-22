/**
 * Logger estruturado (JSON) com requestId, channelSlug, módulo e severity.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  channelSlug?: string;
  module?: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function isLogContext(value: unknown): value is LogContext {
  return Boolean(value) && typeof value === "object" && !(value instanceof Error);
}

function emit(level: LogLevel, message: string, extra?: unknown, error?: unknown): void {
  if (!shouldLog(level)) return;

  const ctx = isLogContext(extra) ? extra : undefined;
  const err = extra instanceof Error ? extra : error;

  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(ctx ?? {}),
    ...(err !== undefined ? { error: formatError(err) } : {}),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, extra?: unknown, error?: unknown) =>
    emit("debug", message, extra, error),
  info: (message: string, extra?: unknown, error?: unknown) =>
    emit("info", message, extra, error),
  warn: (message: string, extra?: unknown, error?: unknown) =>
    emit("warn", message, extra, error),
  error: (message: string, extra?: unknown, error?: unknown) =>
    emit("error", message, extra, error),
};
