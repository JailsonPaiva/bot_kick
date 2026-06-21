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
import { initGameEvents } from "./gameEvents.js";

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

  // Middlewares
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json());

  // Log de requisições
  app.use((req, _res, next) => {
    logger.info(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Rotas
  app.use("/api/auth", createAuthRouter());
  app.use(
    "/api",
    createStatusRouter(services.gameManager, services.playerRepository)
  );
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

  // Rota raiz
  app.get("/", (_req, res) => {
    res.json({
      name: "Kick Bot API",
      version: "3.0.0",
      endpoints: [
        "GET /api/health",
        "GET /api/status",
        "POST /api/auth/login",
        "GET /api/games",
        "DELETE /api/games/:id",
        "GET /api/players",
        "GET /api/players/:id",
        "GET /api/play/session",
        "POST /api/play/move",
      ],
    });
  });

  // WebSocket — eventos de partida em tempo real
  initGameEvents(io);

  server.listen(API_PORT, () => {
    logger.info(`[API] Servidor rodando em http://localhost:${API_PORT}`);
    logger.info(`[API] WebSocket ativo na mesma porta`);
  });

  return { server, io };
}
