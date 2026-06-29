/**
 * Inscrição em eventos webhook da Kick (Events API).
 * Parte 5 — chat.message.sent via POST /public/v1/events/subscriptions
 */

import axios, { type AxiosInstance } from "axios";
import { getValidToken } from "../auth/authManager.js";
import { logger } from "../utils/logger.js";
import {
  CHAT_MESSAGE_SENT_EVENT,
  EVENTS_SUBSCRIPTIONS_URL,
  type EnsureChatWebhookResult,
  type KickCreatedEventSubscription,
  type KickEventSubscription,
  type KickEventSubscriptionsResponse,
  type KickSubscribeEventsBody,
} from "./eventSubscriptionTypes.js";

export {
  CHAT_MESSAGE_SENT_EVENT,
  EVENTS_SUBSCRIPTIONS_URL,
} from "./eventSubscriptionTypes.js";
export type {
  EnsureChatWebhookResult,
  KickCreatedEventSubscription,
  KickEventSubscription,
} from "./eventSubscriptionTypes.js";

export interface EventSubscriptionsDeps {
  getAccessToken: () => Promise<string>;
  http: Pick<AxiosInstance, "get" | "post">;
}

const defaultDeps: EventSubscriptionsDeps = {
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

export function buildChatWebhookSubscribeBody(): KickSubscribeEventsBody {
  return {
    method: "webhook",
    events: [{ ...CHAT_MESSAGE_SENT_EVENT }],
  };
}

export function isChatMessageSentSubscription(
  subscription: KickEventSubscription
): boolean {
  return (
    subscription.event === CHAT_MESSAGE_SENT_EVENT.name &&
    subscription.version === CHAT_MESSAGE_SENT_EVENT.version &&
    subscription.method === "webhook"
  );
}

export function findChatMessageSentSubscription(
  subscriptions: readonly KickEventSubscription[]
): KickEventSubscription | undefined {
  return subscriptions.find(isChatMessageSentSubscription);
}

export function extractCreatedSubscriptionId(
  results: readonly KickCreatedEventSubscription[]
): string {
  const match = results.find(
    (item) =>
      item.name === CHAT_MESSAGE_SENT_EVENT.name &&
      item.version === CHAT_MESSAGE_SENT_EVENT.version
  );

  if (!match) {
    throw new Error(
      `Resposta da Kick não inclui inscrição em ${CHAT_MESSAGE_SENT_EVENT.name}`
    );
  }

  if (match.error) {
    throw new Error(
      `Kick recusou inscrição em ${match.name}: ${match.error}`
    );
  }

  if (!match.subscription_id) {
    throw new Error(
      `Inscrição em ${match.name} sem subscription_id na resposta da Kick`
    );
  }

  return match.subscription_id;
}

function formatKickHttpError(
  action: string,
  error: unknown,
  hint?: string
): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const detail = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;

    const scopeHint =
      status === 401 || status === 403
        ? " Verifique se o token inclui events:subscribe (npm run auth:relogin)."
        : "";

    const extra = hint ? ` ${hint}` : "";
    return new Error(
      `Falha ao ${action} (HTTP ${status ?? "?"}): ${detail}.${scopeHint}${extra}`
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function listEventSubscriptions(
  deps: EventSubscriptionsDeps = defaultDeps
): Promise<KickEventSubscription[]> {
  const token = await deps.getAccessToken();

  try {
    const response = await deps.http.get<
      KickEventSubscriptionsResponse<KickEventSubscription>
    >(EVENTS_SUBSCRIPTIONS_URL, {
      headers: authHeaders(token),
    });

    return response.data.data ?? [];
  } catch (error) {
    throw formatKickHttpError("listar inscrições de eventos", error);
  }
}

export async function subscribeToChatWebhook(
  deps: EventSubscriptionsDeps = defaultDeps
): Promise<string> {
  const token = await deps.getAccessToken();
  const body = buildChatWebhookSubscribeBody();

  try {
    const response = await deps.http.post<
      KickEventSubscriptionsResponse<KickCreatedEventSubscription>
    >(EVENTS_SUBSCRIPTIONS_URL, body, {
      headers: authHeaders(token),
    });

    const subscriptionId = extractCreatedSubscriptionId(response.data.data ?? []);
    logger.info(
      `Inscrição webhook criada: ${CHAT_MESSAGE_SENT_EVENT.name} → ${subscriptionId}`
    );
    return subscriptionId;
  } catch (error) {
    if (error instanceof Error && !axios.isAxiosError(error)) {
      throw error;
    }
    throw formatKickHttpError("inscrever chat.message.sent", error);
  }
}

/**
 * Idempotente: reutiliza inscrição existente ou cria uma nova.
 */
export async function ensureChatWebhookSubscription(
  deps: EventSubscriptionsDeps = defaultDeps
): Promise<EnsureChatWebhookResult> {
  const existing = findChatMessageSentSubscription(
    await listEventSubscriptions(deps)
  );

  if (existing) {
    logger.info(
      `Inscrição webhook já ativa: ${CHAT_MESSAGE_SENT_EVENT.name} → ${existing.id}`
    );
    return { subscriptionId: existing.id, created: false };
  }

  const subscriptionId = await subscribeToChatWebhook(deps);
  return { subscriptionId, created: true };
}
