/**
 * Rotas de status do bot.
 */

import { Router } from "express";
import type { GameManager } from "../../games/engine/gameManager.js";
import type { PlayerRepository } from "../../db/repositories/playerRepository.js";
import type { BotStatusResponse, ApiResponse } from "../types.js";

const startTime = Date.now();

export function createStatusRouter(
  gameManager: GameManager,
  playerRepository: PlayerRepository
): Router {
  const router = Router();

  router.get("/status", (_req, res) => {
    const activeGames = Array.from(
      (gameManager as any).sessions.values()
    ).length;
    
    const totalPlayers = playerRepository.getTopN(10000).length;

    const response: ApiResponse<BotStatusResponse> = {
      success: true,
      data: {
        online: true,
        uptime: Date.now() - startTime,
        activeGames,
        totalPlayers,
        version: "3.0.0",
      },
    };

    res.json(response);
  });

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return router;
}
