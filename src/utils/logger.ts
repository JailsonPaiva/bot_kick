/**
 * Logger simples com timestamp e nível de severidade.
 * Usado em todo o projeto para rastrear fluxos OAuth, WebSocket e chat.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

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

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function log(level: LogLevel, message: string, error?: unknown): void {
  if (!shouldLog(level)) return;

  const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}]`;
  if (error !== undefined) {
    console.error(`${prefix} ${message} — ${formatError(error)}`);
  } else if (level === "error") {
    console.error(`${prefix} ${message}`);
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  debug: (message: string, error?: unknown) => log("debug", message, error),
  info: (message: string, error?: unknown) => log("info", message, error),
  warn: (message: string, error?: unknown) => log("warn", message, error),
  error: (message: string, error?: unknown) => log("error", message, error),
};
