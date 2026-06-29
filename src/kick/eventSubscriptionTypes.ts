/**
 * Tipos e constantes da Events API Kick (webhooks).
 * @see https://docs.kick.com/events/subscribe-to-events
 */

export const EVENTS_SUBSCRIPTIONS_URL =
  "https://api.kick.com/public/v1/events/subscriptions";

export const CHAT_MESSAGE_SENT_EVENT = {
  name: "chat.message.sent",
  version: 1,
} as const;

export type KickWebhookDeliveryMethod = "webhook";

export interface KickSubscribeEventInput {
  name: string;
  version: number;
}

export interface KickSubscribeEventsBody {
  broadcaster_user_id?: number;
  method: KickWebhookDeliveryMethod;
  events: KickSubscribeEventInput[];
}

/** Item retornado por GET /events/subscriptions */
export interface KickEventSubscription {
  id: string;
  app_id: string;
  broadcaster_user_id: number;
  event: string;
  version: number;
  method: string;
  created_at: string;
  updated_at: string;
}

/** Item retornado por POST /events/subscriptions */
export interface KickCreatedEventSubscription {
  subscription_id?: string;
  name: string;
  version: number;
  error?: string;
}

export interface KickEventSubscriptionsResponse<T> {
  data: T[];
}

export interface EnsureChatWebhookResult {
  subscriptionId: string;
  created: boolean;
}
