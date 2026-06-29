/**
 * Cliente da API oficial Kick para moderação de chat (Parte 9).
 */

import axios, { type AxiosInstance } from "axios";
import { getValidToken } from "../auth/authManager.js";

const CHAT_API_BASE = "https://api.kick.com/public/v1/chat";
const MODERATION_BANS_URL = "https://api.kick.com/public/v1/moderation/bans";

export interface KickModerationDeps {
  getAccessToken: () => Promise<string>;
  http: Pick<AxiosInstance, "delete" | "post">;
}

const defaultDeps: KickModerationDeps = {
  getAccessToken: getValidToken,
  http: axios,
};

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function formatKickError(action: string, error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const detail = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;

    const scopeHint =
      status === 403
        ? " Verifique scopes moderation:ban / moderation:chat_message:manage e refaça npm run auth:relogin."
        : "";

    return new Error(
      `Falha ao ${action} (HTTP ${status ?? "?"}): ${detail}.${scopeHint}`
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function deleteKickChatMessage(
  messageId: string,
  deps: KickModerationDeps = defaultDeps
): Promise<void> {
  const token = await deps.getAccessToken();

  try {
    await deps.http.delete(`${CHAT_API_BASE}/${encodeURIComponent(messageId)}`, {
      headers: authHeaders(token),
    });
  } catch (error) {
    throw formatKickError("apagar mensagem do chat", error);
  }
}

export interface KickBanUserParams {
  broadcasterUserId: number;
  userId: number;
  durationMinutes?: number;
  reason?: string;
}

export async function banKickUser(
  params: KickBanUserParams,
  deps: KickModerationDeps = defaultDeps
): Promise<void> {
  const token = await deps.getAccessToken();

  const body: Record<string, unknown> = {
    broadcaster_user_id: params.broadcasterUserId,
    user_id: params.userId,
  };

  if (params.durationMinutes !== undefined) {
    body.duration = params.durationMinutes;
  }
  if (params.reason) {
    body.reason = params.reason;
  }

  try {
    await deps.http.post(MODERATION_BANS_URL, body, {
      headers: authHeaders(token),
    });
  } catch (error) {
    throw formatKickError("banir/timeout usuário", error);
  }
}

export interface KickUnbanUserParams {
  broadcasterUserId: number;
  userId: number;
}

export async function unbanKickUser(
  params: KickUnbanUserParams,
  deps: KickModerationDeps = defaultDeps
): Promise<void> {
  const token = await deps.getAccessToken();

  try {
    await deps.http.delete(MODERATION_BANS_URL, {
      headers: authHeaders(token),
      data: {
        broadcaster_user_id: params.broadcasterUserId,
        user_id: params.userId,
      },
    });
  } catch (error) {
    throw formatKickError("remover ban/timeout", error);
  }
}
