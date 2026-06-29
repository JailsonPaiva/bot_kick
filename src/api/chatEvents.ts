/**
 * Eventos Socket.io para chat ao vivo (Parte 7 — relay webhook → dashboard).
 */

import type { Server, Socket } from "socket.io";
import { verifyToken, type JWTPayload } from "./auth.js";
import { logger } from "../utils/logger.js";
import type { LiveChatMessage } from "../kick/liveChatMessage.js";

let io: Server | null = null;

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
  if (!io) return;

  const payload: ChatMessageEventPayload = {
    ...message,
    timestamp: Date.now(),
  };

  io.to(chatRoom(channelSlug)).emit("chat:message", payload);
}
