/**
 * Rotas de jogadores e ranking.
 */

import { Router } from "express";
import type { PlayerRepository } from "../../db/repositories/playerRepository.js";
import type { PlayerRankingItem, ApiResponse } from "../types.js";
import { authMiddleware } from "../auth.js";

export function createPlayersRouter(
  playerRepository: PlayerRepository
): Router {
  const router = Router();

  // Ranking completo (paginado)
  router.get("/players", authMiddleware, (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string | undefined;

    try {
      let players = playerRepository.getTopN(1000);

      // Filtro de busca por username
      if (search) {
        const searchLower = search.toLowerCase();
        players = players.filter((p) =>
          p.username.toLowerCase().includes(searchLower)
        );
      }

      const rankedPlayers: PlayerRankingItem[] = players.map((p, index) => ({
        id: p.id,
        kickUserId: p.kick_user_id,
        username: p.username,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        points: p.points,
        rank: index + 1,
      }));

      const paginatedPlayers = rankedPlayers.slice(
        (page - 1) * limit,
        page * limit
      );

      const response: ApiResponse<{
        players: PlayerRankingItem[];
        total: number;
        page: number;
        totalPages: number;
      }> = {
        success: true,
        data: {
          players: paginatedPlayers,
          total: rankedPlayers.length,
          page,
          totalPages: Math.ceil(rankedPlayers.length / limit),
        },
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao buscar jogadores";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Buscar jogador específico
  router.get("/players/:id", authMiddleware, (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const playerId = parseInt(id);

    try {
      const player = playerRepository.findById(playerId);

      if (!player) {
        res.status(404).json({ success: false, error: "Jogador não encontrado" });
        return;
      }

      const allPlayers = playerRepository.getTopN(1000);
      const rank = allPlayers.findIndex((p) => p.id === playerId) + 1;

      const response: ApiResponse<PlayerRankingItem> = {
        success: true,
        data: {
          id: player.id,
          kickUserId: player.kick_user_id,
          username: player.username,
          wins: player.wins,
          losses: player.losses,
          draws: player.draws,
          points: player.points,
          rank,
        },
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao buscar jogador";
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
