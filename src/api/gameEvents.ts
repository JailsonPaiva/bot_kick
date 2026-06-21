/**
 * Eventos Socket.io para sincronização chat ↔ interface web.
 */

import type { Server, Socket } from "socket.io";
import { logger } from "../utils/logger.js";
import { verifyPlayerToken } from "./playerAuth.js";
import type { PlayGameView } from "../games/ttt/tttPlayService.js";

let io: Server | null = null;

export function initGameEvents(server: Server): void {
  io = server;

  io.on("connection", (socket: Socket) => {
    logger.info(`[WebSocket] Cliente conectado: ${socket.id}`);

    socket.on("join:game", (data: { token?: string }) => {
      if (!data?.token) return;

      const payload = verifyPlayerToken(data.token);
      if (!payload) {
        socket.emit("game:error", { error: "Token inválido ou expirado" });
        return;
      }

      const room = playerGameRoom(payload.channelSlug, payload.kickUserId);
      socket.join(room);
      logger.info(`[WebSocket] ${socket.id} entrou em ${room}`);
    });

    socket.on("disconnect", () => {
      logger.info(`[WebSocket] Cliente desconectado: ${socket.id}`);
    });
  });
}

function playerGameRoom(channelSlug: string, kickUserId: number): string {
  return `game:${channelSlug}:${kickUserId}`;
}

export function broadcastGameUpdate(
  channelSlug: string,
  kickUserId: number,
  view: PlayGameView,
  event: "start" | "move" | "end" | "waiting" = "move"
): void {
  if (!io) return;

  io.to(playerGameRoom(channelSlug, kickUserId)).emit("game:update", {
    event,
    game: view,
    timestamp: Date.now(),
  });
}
