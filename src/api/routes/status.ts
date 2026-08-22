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
import { fetchChannelLiveStatus } from "../../kick/fetchChannelLiveStatus.js";

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
    const channelSlug = process.env.KICK_CHANNEL_SLUG ?? "";
    const liveStatus = await fetchChannelLiveStatus(channelSlug);
    const botOnline = health.dependencies.websocket.status !== "down";

    const response: ApiResponse<BotStatusResponse> = {
      success: true,
      data: {
        online: liveStatus.live,
        botOnline,
        live: liveStatus.live,
        viewerCount: liveStatus.viewerCount,
        subscriberCount: liveStatus.subscriberCount,
        liveDurationSeconds: liveStatus.liveDurationSeconds,
        streamTitle: liveStatus.streamTitle,
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
