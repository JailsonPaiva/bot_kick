/**
 * Validação de payloads para moderação de chat Kick (Parte 9).
 */

export interface ParsedBanUserRequest {
  userId: number;
  channelSlug?: string;
  durationMinutes?: number;
  reason?: string;
}

export interface ParsedUnbanUserRequest {
  userId: number;
  channelSlug?: string;
}

export type ParseBanUserResult =
  | { ok: true; value: ParsedBanUserRequest }
  | { ok: false; error: string };

export type ParseUnbanUserResult =
  | { ok: true; value: ParsedUnbanUserRequest }
  | { ok: false; error: string };

export type ValidateMessageIdResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

const MAX_BAN_REASON_LENGTH = 100;
const MAX_TIMEOUT_MINUTES = 10_080;

function parseOptionalChannelSlug(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseUserId(value: unknown): number | null {
  const userId =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }
  return userId;
}

export function validateChatMessageIdParam(raw: unknown): ValidateMessageIdResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "messageId inválido" };
  }
  return { ok: true, messageId: raw.trim() };
}

export function parseBanUserBody(body: Record<string, unknown>): ParseBanUserResult {
  const userId = parseUserId(body.userId);
  if (userId === null) {
    return { ok: false, error: "userId deve ser um inteiro positivo" };
  }

  let durationMinutes: number | undefined;
  if (body.durationMinutes !== undefined && body.durationMinutes !== null) {
    const duration =
      typeof body.durationMinutes === "number"
        ? body.durationMinutes
        : Number.parseInt(String(body.durationMinutes), 10);

    if (!Number.isInteger(duration) || duration < 1 || duration > MAX_TIMEOUT_MINUTES) {
      return {
        ok: false,
        error: `durationMinutes deve ser entre 1 e ${MAX_TIMEOUT_MINUTES}`,
      };
    }
    durationMinutes = duration;
  }

  let reason: string | undefined;
  if (typeof body.reason === "string" && body.reason.trim()) {
    const trimmed = body.reason.trim();
    if (trimmed.length > MAX_BAN_REASON_LENGTH) {
      return {
        ok: false,
        error: `reason excede ${MAX_BAN_REASON_LENGTH} caracteres`,
      };
    }
    reason = trimmed;
  }

  return {
    ok: true,
    value: {
      userId,
      channelSlug: parseOptionalChannelSlug(body.channelSlug),
      durationMinutes,
      reason,
    },
  };
}

export function parseUnbanUserBody(body: Record<string, unknown>): ParseUnbanUserResult {
  const userId = parseUserId(body.userId);
  if (userId === null) {
    return { ok: false, error: "userId deve ser um inteiro positivo" };
  }

  return {
    ok: true,
    value: {
      userId,
      channelSlug: parseOptionalChannelSlug(body.channelSlug),
    },
  };
}
