/**
 * Servidor Express para API REST do dashboard.
 */

import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import http from "node:http";
import type { GameServices } from "../games/index.js";
import { logger } from "../utils/logger.js";
import { createStatusRouter } from "./routes/status.js";
import { createGamesRouter } from "./routes/games.js";
import { createPlayersRouter } from "./routes/players.js";
import { createAuthRouter } from "./routes/auth.js";
import { createPlayRouter } from "./routes/play.js";
import { createCommandsRouter } from "./routes/commands.js";
import { createTimersRouter } from "./routes/timers.js";
import { createModerationRouter } from "./routes/moderation.js";
import { createLoyaltyRouter } from "./routes/loyalty.js";
import { createAlertsRouter } from "./routes/alerts.js";
import { initGameEvents } from "./gameEvents.js";
import { initAlertEvents } from "./alertEvents.js";

const API_PORT = parseInt(process.env.API_PORT || "3001", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

export function startApiServer(services: GameServices): {
  server: http.Server;
  io: SocketIOServer;
} {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
  });

  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json());

  app.use((req, _res, next) => {
    logger.info(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Autenticação do dashboard
  app.use("/api/auth", createAuthRouter());

  // Status e health
  app.use(
    "/api",
    createStatusRouter(services.gameManager, services.playerRepository)
  );

  // Jogos e jogadores
  app.use(
    "/api",
    createGamesRouter(
      services.gameRepository,
      services.playerRepository,
      services.gameManager
    )
  );
  app.use("/api", createPlayersRouter(services.playerRepository));
  app.use("/api", createPlayRouter(services));

  // Fase 2 — Comandos, Timers, Moderação
  app.use("/api", createCommandsRouter());
  app.use("/api", createTimersRouter());
  app.use("/api", createModerationRouter());
  app.use("/api", createLoyaltyRouter());
  app.use("/api", createAlertsRouter());

  app.get("/", (_req, res) => {
    res.json({
      name: "Kick Bot API",
      version: "4.0.0",
      endpoints: {
        auth: ["POST /api/auth/login"],
        status: ["GET /api/health", "GET /api/status"],
        games: ["GET /api/games", "DELETE /api/games/:id"],
        players: ["GET /api/players", "GET /api/players/:id"],
        play: ["GET /api/play/session", "POST /api/play/move"],
        commands: [
          "GET /api/commands",
          "POST /api/commands",
          "PUT /api/commands/:id",
          "PATCH /api/commands/:id/toggle",
          "DELETE /api/commands/:id",
        ],
        timers: [
          "GET /api/timers",
          "POST /api/timers",
          "PUT /api/timers/:id",
          "PATCH /api/timers/:id/toggle",
          "DELETE /api/timers/:id",
        ],
        moderation: [
          "GET /api/moderation",
          "PUT /api/moderation",
          "GET /api/moderation/logs",
        ],
        loyalty: [
          "GET /api/loyalty/top",
          "GET /api/loyalty/transactions",
        ],
        alerts: [
          "GET /api/alerts/config",
          "PUT /api/alerts/config",
          "POST /api/alerts/test",
        ],
      },
    });
  });

  initGameEvents(io);
  initAlertEvents(io);

  server.listen(API_PORT, () => {
    logger.info(`[API] Servidor rodando em http://localhost:${API_PORT}`);
    logger.info("[API] WebSocket ativo na mesma porta");
  });

  return { server, io };
}
