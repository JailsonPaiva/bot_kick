/**
 * Eventos Socket.io para alertas em tempo real (overlay/dashboard).
 */

import type { Server, Socket } from "socket.io";
import { logger } from "../utils/logger.js";

let io: Server | null = null;

function alertsRoom(channelSlug: string): string {
  return `alerts:${channelSlug}`;
}

export function initAlertEvents(server: Server): void {
  io = server;

  io.on("connection", (socket: Socket) => {
    socket.on("join:alerts", (data: { channelSlug?: string }) => {
      const channelSlug = data?.channelSlug?.trim();
      if (!channelSlug) return;
      const room = alertsRoom(channelSlug);
      socket.join(room);
      logger.info(`[ALERTS] ${socket.id} entrou em ${room}`);
    });
  });
}

export interface LiveAlertPayload {
  type: string;
  channelSlug: string;
  title: string;
  message: string;
  imageUrl?: string | null;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export function broadcastAlert(payload: LiveAlertPayload): void {
  if (!io) return;
  io.to(alertsRoom(payload.channelSlug)).emit("alert:event", {
    ...payload,
    timestamp: Date.now(),
  });
}
