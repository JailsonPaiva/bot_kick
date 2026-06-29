/**
 * Tipos dos payloads de webhook oficial Kick (Events API).
 * @see https://docs.kick.com/events/webhook-payloads
 */

export interface KickWebhookHeaders {
  messageId: string;
  subscriptionId?: string;
  signature: string;
  timestamp: string;
  eventType: string;
  eventVersion: string;
}

export interface KickWebhookUser {
  is_anonymous?: boolean;
  user_id: number;
  username: string;
  is_verified?: boolean;
  profile_picture?: string | null;
  channel_slug?: string;
  identity?: {
    username_color?: string;
    badges?: Array<{
      text: string;
      type: string;
      count?: number;
    }>;
  } | null;
}

export interface KickChatMessageSentPayload {
  message_id: string;
  content: string;
  created_at: string;
  broadcaster: KickWebhookUser;
  sender: KickWebhookUser;
  replies_to?: {
    message_id: string;
    content: string;
    sender: KickWebhookUser;
  } | null;
  emotes?: Array<{
    emote_id: string;
    positions: Array<{ s: number; e: number }>;
  }>;
}

export type KickWebhookPayload = KickChatMessageSentPayload | Record<string, unknown>;
