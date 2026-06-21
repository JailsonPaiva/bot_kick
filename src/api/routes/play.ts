/**
 * Rotas da interface web para jogadores (jogo da velha).
 */

import { Router } from "express";
import type { GameServices } from "../../games/index.js";
import { playerAuthMiddleware } from "../playerAuth.js";
import type { ApiResponse, AuthRequest } from "../types.js";
import {
  buildPlayGameView,
  executeTttMove,
  type PlayGameView,
} from "../../games/ttt/tttPlayService.js";

export function createPlayRouter(services: GameServices): Router {
  const router = Router();
  const deps = {
    gameManager: services.gameManager,
    gameRepository: services.gameRepository,
    playerRepository: services.playerRepository,
  };

  router.get("/play/session", playerAuthMiddleware, (req: AuthRequest, res) => {
    const player = req.player!;
    const session = services.gameManager.getActiveSession(player.channelSlug);

    if (!session || session.id !== player.gameId) {
      res.status(404).json({
        success: false,
        error: "Partida não encontrada ou encerrada.",
      });
      return;
    }

    const view = buildPlayGameView(session, player.kickUserId);
    if (!view) {
      res.status(400).json({ success: false, error: "Partida inválida." });
      return;
    }

    const response: ApiResponse<PlayGameView & { token: string }> = {
      success: true,
      data: {
        ...view,
        token:
          typeof req.query.token === "string"
            ? req.query.token
            : req.headers.authorization?.substring(7) ?? "",
      },
    };

    res.json(response);
  });

  router.post("/play/move", playerAuthMiddleware, async (req: AuthRequest, res) => {
    const player = req.player!;
    const position = Number(req.body?.position);

    if (!Number.isFinite(position) || position < 1 || position > 9) {
      res.status(400).json({
        success: false,
        error: "Posição inválida. Use valores de 1 a 9.",
      });
      return;
    }

    const session = services.gameManager.getActiveSession(player.channelSlug);
    if (!session || session.id !== player.gameId) {
      res.status(404).json({
        success: false,
        error: "Partida não encontrada ou encerrada.",
      });
      return;
    }

    const result = await executeTttMove(deps, player.channelSlug, {
      kickUserId: player.kickUserId,
      username: player.username,
      slug: player.slug,
    }, position);

    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    const activeSession = services.gameManager.getActiveSession(player.channelSlug);
    const view = buildPlayGameView(activeSession, player.kickUserId);

    const response: ApiResponse<{
      game: PlayGameView | null;
      finished: boolean;
      message?: string;
    }> = {
      success: true,
      data: {
        game: view,
        finished: !activeSession,
        message: result.announceMessage,
      },
    };

    res.json(response);
  });

  return router;
}
