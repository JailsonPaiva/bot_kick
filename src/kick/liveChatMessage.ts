/**
 * Modelo normalizado de mensagem de chat ao vivo (Parte 7).
 */

import type { KickChatMessageSentPayload } from "./webhookTypes.js";

export interface LiveChatBadge {
  type: string;
  text: string;
  count?: number;
}

export interface LiveChatSender {
  userId: number;
  username: string;
  color?: string;
  badges: LiveChatBadge[];
  avatarUrl?: string;
}

export interface LiveChatReplyTo {
  messageId: string;
  content: string;
  username: string;
}

export interface LiveChatEmote {
  emoteId: string;
  positions: Array<{ start: number; end: number }>;
}

export interface LiveChatMessage {
  id: string;
  content: string;
  createdAt: string;
  channelSlug: string;
  sender: LiveChatSender;
  replyTo?: LiveChatReplyTo;
  emotes?: LiveChatEmote[];
}

export function resolveChatChannelSlug(
  payload: KickChatMessageSentPayload,
  fallbackSlug?: string
): string | null {
  const fromPayload =
    payload.broadcaster?.channel_slug?.trim() ||
    payload.sender?.channel_slug?.trim() ||
    "";

  if (fromPayload) {
    return fromPayload;
  }

  const fallback = fallbackSlug?.trim();
  return fallback || null;
}

export function normalizeKickChatMessage(
  payload: KickChatMessageSentPayload,
  fallbackChannelSlug?: string
): LiveChatMessage | null {
  const channelSlug = resolveChatChannelSlug(payload, fallbackChannelSlug);
  if (!channelSlug) {
    return null;
  }

  const badges = payload.sender?.identity?.badges ?? [];

  return {
    id: payload.message_id,
    content: payload.content ?? "",
    createdAt: payload.created_at,
    channelSlug,
    sender: {
      userId: payload.sender?.user_id ?? 0,
      username: payload.sender?.username ?? "?",
      color: payload.sender?.identity?.username_color,
      badges: badges.map((badge) => ({
        type: badge.type,
        text: badge.text,
        count: badge.count,
      })),
      avatarUrl: payload.sender?.profile_picture ?? undefined,
    },
    replyTo: payload.replies_to
      ? {
          messageId: payload.replies_to.message_id,
          content: payload.replies_to.content,
          username: payload.replies_to.sender?.username ?? "?",
        }
      : undefined,
    emotes: payload.emotes?.map((emote) => ({
      emoteId: emote.emote_id,
      positions: emote.positions.map((pos) => ({
        start: pos.s,
        end: pos.e,
      })),
    })),
  };
}
