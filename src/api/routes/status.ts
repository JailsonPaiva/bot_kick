/**
 * Rotas de status do bot.
 */

import { Router } from "express";
import type { GameManager } from "../../games/engine/gameManager.js";
import type { PlayerRepository } from "../../db/repositories/playerRepository.js";
import type { BotStatusResponse, ApiResponse } from "../types.js";
import { collectDeepHealth } from "../../ops/deepHealth.js";
import { APP_VERSION } from "../../ops/appVersion.js";
import { getStartedAt, metrics } from "../../ops/metrics.js";
import { evaluateSlos } from "../../ops/slo.js";

export function createStatusRouter(
  gameManager: GameManager,
  playerRepository: PlayerRepository
): Router {
  const router = Router();

  router.get("/status", async (_req, res) => {
    const activeGames = Array.from(
      (gameManager as unknown as { sessions: Map<unknown, unknown> }).sessions.values()
    ).length;

    const players = await playerRepository.getTopN(10000);
    const health = await collectDeepHealth();

    const response: ApiResponse<BotStatusResponse> = {
      success: true,
      data: {
        online: health.dependencies.websocket.status !== "down",
        uptime: Date.now() - getStartedAt(),
        activeGames,
        totalPlayers: players.length,
        version: APP_VERSION,
      },
    };

    res.json(response);
  });

  router.get("/health", async (_req, res) => {
    const health = await collectDeepHealth();
    const httpStatus = health.status === "down" ? 503 : 200;
    res.status(httpStatus).json(health);
  });

  router.get("/metrics", (_req, res) => {
    res.json({ success: true, data: metrics.snapshot() });
  });

  router.get("/slo", (_req, res) => {
    res.json({ success: true, data: evaluateSlos() });
  });

  return router;
}
