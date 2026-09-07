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
import { createGiveawaysRouter } from "./routes/giveaways.js";
import { createPollsRouter } from "./routes/polls.js";
import { createPublicRouter } from "./routes/public.js";
import { createKickWebhooksRouter } from "./routes/kickWebhooks.js";
import { createChatRouter } from "./routes/chat.js";
import { createOpsRouter } from "./routes/ops.js";
import { createSetupRouter } from "./routes/setup.js";
import { initGameEvents } from "./gameEvents.js";
import { initAlertEvents } from "./alertEvents.js";
import { initChatEvents } from "./chatEvents.js";
import { setupSwagger } from "./swagger.js";
import { requestContextMiddleware } from "./requestContext.js";

const API_PORT = parseInt(process.env.PORT || process.env.API_PORT || "3001", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

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

  // Webhook Kick — body raw obrigatório (antes de express.json)
  app.use(
    "/api/kick/webhooks",
    express.raw({ type: "application/json", limit: "1mb" }),
    createKickWebhooksRouter()
  );

  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json());
  app.use(requestContextMiddleware);

  // Setup inicial (criar primeiro admin)
  app.use("/api/setup", createSetupRouter());

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
  app.use("/api", createGiveawaysRouter());
  app.use("/api", createPollsRouter());
  app.use("/api", createPublicRouter());
  app.use("/api", createChatRouter());
  app.use("/api", createOpsRouter());

  setupSwagger(app);

  app.get("/", (_req, res) => {
    res.json({
      name: "Kick Bot API",
      version: "4.0.0",
      docs: {
        swagger: "/api/docs",
        openapi: "/api/docs/openapi.json",
      },
      endpoints: {
        auth: ["POST /api/auth/login"],
        status: ["GET /api/health", "GET /api/status", "GET /api/metrics", "GET /api/slo"],
        ops: [
          "GET /api/ops/flags",
          "PUT /api/ops/flags",
          "GET /api/ops/snapshots",
          "POST /api/ops/snapshots",
          "POST /api/ops/snapshots/:id/restore",
          "GET /api/ops/pilot",
        ],
        games: ["GET /api/games", "DELETE /api/games/:id"],
        players: ["GET /api/players", "GET /api/players/:id"],
        play: ["GET /api/play/session", "POST /api/play/move"],
        commands: [
          "GET /api/commands",
          "POST /api/commands",
          "PUT /api/commands/:id",
          "PATCH /api/commands/:id/toggle",
          "DELETE /api/commands/:id",
          "GET /api/commands/system",
          "PUT /api/commands/system/:trigger",
          "PATCH /api/commands/system/:trigger/toggle",
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
          "GET /api/loyalty/config",
          "PUT /api/loyalty/config",
          "POST /api/loyalty/test-event",
          "GET /api/loyalty/store/items",
          "POST /api/loyalty/store/items",
          "PUT /api/loyalty/store/items/:id",
          "DELETE /api/loyalty/store/items/:id",
          "GET /api/loyalty/store/redemptions",
        ],
        alerts: [
          "GET /api/alerts/overlay-token",
          "GET /api/alerts/config",
          "PUT /api/alerts/config",
          "POST /api/alerts/test",
        ],
        giveaways: [
          "GET /api/giveaways",
          "POST /api/giveaways",
          "POST /api/giveaways/draw",
          "POST /api/giveaways/reroll",
          "GET /api/giveaways/widget-config",
          "PUT /api/giveaways/widget-config",
        ],
        polls: [
          "GET /api/polls",
          "POST /api/polls",
          "POST /api/polls/end",
        ],
        public: ["GET /api/public/ranking/:channelSlug"],
        chat: [
          "POST /api/chat/send",
          "DELETE /api/chat/:messageId",
          "POST /api/chat/moderation/ban",
          "DELETE /api/chat/moderation/ban",
        ],
        kickWebhooks: ["POST /api/kick/webhooks/events"],
      },
    });
  });

  initGameEvents(io);
  initAlertEvents(io);
  initChatEvents(io);

  server.listen(API_PORT, () => {
    logger.info(`[API] Servidor rodando em http://localhost:${API_PORT}`);
    logger.info("[API] WebSocket ativo na mesma porta");
  });

  return { server, io };
}
