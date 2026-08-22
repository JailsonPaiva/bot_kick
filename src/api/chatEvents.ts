/**
 * Eventos Socket.io para chat ao vivo (Parte 7 — relay webhook → dashboard).
 */

import type { Server, Socket } from "socket.io";
import { verifyToken, type JWTPayload } from "./auth.js";
import { logger } from "../utils/logger.js";
import type { LiveChatMessage } from "../kick/liveChatMessage.js";

let io: Server | null = null;
const CHAT_HISTORY_LIMIT = Number.parseInt(
  process.env.CHAT_HISTORY_LIMIT ?? "200",
  10
);
const chatHistory = new Map<string, ChatMessageEventPayload[]>();

export interface JoinChatPayload {
  token?: string;
  channelSlug?: string;
}

export type JoinChatResult =
  | { ok: true; channelSlug: string }
  | { ok: false; error: string };

export function chatRoom(channelSlug: string): string {
  return `chat:${channelSlug}`;
}

export function parseJoinChatPayload(
  data: JoinChatPayload | undefined,
  verify: (token: string) => JWTPayload | null = verifyToken
): JoinChatResult {
  const token = data?.token?.trim();
  if (!token) {
    return { ok: false, error: "Token não fornecido" };
  }

  const payload = verify(token);
  if (!payload || payload.role !== "admin") {
    return { ok: false, error: "Token inválido ou expirado" };
  }

  const channelSlug = data?.channelSlug?.trim();
  if (!channelSlug) {
    return { ok: false, error: "channelSlug obrigatório" };
  }

  return { ok: true, channelSlug };
}

export function initChatEvents(server: Server): void {
  io = server;

  io.on("connection", (socket: Socket) => {
    socket.on("join:chat", (data: JoinChatPayload) => {
      const result = parseJoinChatPayload(data);
      if (!result.ok) {
        socket.emit("chat:error", { error: result.error });
        return;
      }

      const room = chatRoom(result.channelSlug);
      socket.join(room);
      logger.info(`[CHAT] ${socket.id} entrou em ${room}`);
      socket.emit("chat:joined", { channelSlug: result.channelSlug });
      socket.emit("chat:history", getChatHistory(result.channelSlug));
    });
  });
}

export interface ChatMessageEventPayload extends LiveChatMessage {
  timestamp: number;
}

export function broadcastChatMessage(
  channelSlug: string,
  message: LiveChatMessage
): void {
  const payload: ChatMessageEventPayload = {
    ...message,
    timestamp: Date.now(),
  };
  appendChatHistory(channelSlug, payload);

  if (!io) return;

  io.to(chatRoom(channelSlug)).emit("chat:message", payload);
}

function appendChatHistory(
  channelSlug: string,
  payload: ChatMessageEventPayload
): void {
  const list = chatHistory.get(channelSlug) ?? [];
  if (list.some((item) => item.id === payload.id)) return;
  list.push(payload);
  const trimmed =
    list.length > CHAT_HISTORY_LIMIT
      ? list.slice(list.length - CHAT_HISTORY_LIMIT)
      : list;
  chatHistory.set(channelSlug, trimmed);
}

function getChatHistory(channelSlug: string): ChatMessageEventPayload[] {
  return [...(chatHistory.get(channelSlug) ?? [])];
}

export function __getChatHistoryForTests(
  channelSlug: string
): ChatMessageEventPayload[] {
  return getChatHistory(channelSlug);
}

export function __resetChatHistoryForTests(): void {
  chatHistory.clear();
}
