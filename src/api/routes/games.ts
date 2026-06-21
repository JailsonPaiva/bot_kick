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

  // Histórico de partidas (paginado)
  router.get("/games", authMiddleware, (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
      // Por enquanto, pegar todos os jogos (TODO: implementar paginação no repository)
      const allGames = gameRepository.findAllActive();
      
      const games: GameHistoryItem[] = allGames.map((game) => {
        const playerX = playerRepository.findById(game.player_x_id);
        const playerO = playerRepository.findById(game.player_o_id);
        const winner = game.winner_id
          ? playerRepository.findById(game.winner_id)
          : null;

        return {
          id: game.id,
          gameType: game.game_type,
          channelSlug: game.channel_slug,
          playerXUsername: playerX?.username || "Desconhecido",
          playerOUsername: playerO?.username || "Desconhecido",
          winnerUsername: winner?.username || null,
          status: game.status,
          startedAt: game.started_at,
          finishedAt: game.finished_at,
        };
      });

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

  // Cancelar partida ativa
  router.delete("/games/:id", authMiddleware, async (req, res) => {
    const gameId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const game = gameRepository.findById(gameId);
      
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
        channelSlug: game.channel_slug,
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
