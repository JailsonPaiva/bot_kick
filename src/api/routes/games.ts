/**
 * Rotas de jogos e histórico.
 */

import { Router } from "express";
import type { GameRepository } from "../../db/repositories/gameRepository.js";
import type { PlayerRepository } from "../../db/repositories/playerRepository.js";
import type { GameManager } from "../../games/engine/gameManager.js";
import type { GameHistoryItem, ApiResponse } from "../types.js";
import { authMiddleware } from "../auth.js";

export function createGamesRouter(
  gameRepository: GameRepository,
  playerRepository: PlayerRepository,
  gameManager: GameManager
): Router {
  const router = Router();

  router.get("/games", authMiddleware, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
      const allGames = await gameRepository.findAllActive();

      const games: GameHistoryItem[] = await Promise.all(
        allGames.map(async (game) => {
          const [playerX, playerO, winner] = await Promise.all([
            playerRepository.findById(game.playerXId),
            playerRepository.findById(game.playerOId),
            game.winnerId ? playerRepository.findById(game.winnerId) : Promise.resolve(null),
          ]);

          return {
            id: game.id,
            gameType: game.gameType,
            channelSlug: game.channelSlug,
            playerXUsername: playerX?.username ?? "Desconhecido",
            playerOUsername: playerO?.username ?? "Desconhecido",
            winnerUsername: winner?.username ?? null,
            status: game.status,
            startedAt: game.startedAt.toISOString(),
            finishedAt: game.finishedAt?.toISOString() ?? null,
          };
        })
      );

      const response: ApiResponse<GameHistoryItem[]> = {
        success: true,
        data: games.slice((page - 1) * limit, page * limit),
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao buscar jogos";
      res.status(500).json({ success: false, error: message });
    }
  });

  router.delete("/games/:id", authMiddleware, async (req, res) => {
    const gameId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const game = await gameRepository.findById(gameId);

      if (!game) {
        res.status(404).json({ success: false, error: "Partida não encontrada" });
        return;
      }

      if (game.status !== "active") {
        res.status(400).json({
          success: false,
          error: "Partida não está ativa",
        });
        return;
      }

      await gameManager.endGame({
        channelSlug: game.channelSlug,
        reason: "timeout",
        announceMessage: "⚠️ Partida cancelada pelo administrador.",
      });

      res.json({ success: true, message: "Partida cancelada com sucesso" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao cancelar partida";
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
