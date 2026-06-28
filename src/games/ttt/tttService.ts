/**
 * Serviço auxiliar do jogo da velha — registro de jogadores e stats pós-partida.
 */

import type { PlayerRepository } from "../../db/repositories/playerRepository.js";
import type { PlayerRecord } from "../../db/types.js";
import type { ActiveGameSession } from "../types.js";

export interface ChatPlayer {
  kickUserId: number;
  username: string;
  slug: string;
}

export async function registerPlayer(
  playerRepository: PlayerRepository,
  player: ChatPlayer
): Promise<PlayerRecord> {
  return playerRepository.findOrCreate({
    kickUserId: player.kickUserId,
    username: player.username,
    slug: player.slug,
  });
}

export async function registerSessionPlayers(
  playerRepository: PlayerRepository,
  session: ActiveGameSession
): Promise<void> {
  await registerPlayer(playerRepository, {
    kickUserId: session.playerX.kickUserId,
    username: session.playerX.username,
    slug: session.playerX.slug,
  });

  if (session.playerO) {
    await registerPlayer(playerRepository, {
      kickUserId: session.playerO.kickUserId,
      username: session.playerO.username,
      slug: session.playerO.slug,
    });
  }
}

export interface StatsOutcome {
  winner?: PlayerRecord;
  loser?: PlayerRecord;
  playerX?: PlayerRecord;
  playerO?: PlayerRecord;
}

export async function applyTttStats(
  playerRepository: PlayerRepository,
  session: ActiveGameSession,
  outcome: "x_win" | "o_win" | "draw"
): Promise<StatsOutcome> {
  if (!session.playerO) return {};

  if (outcome === "draw") {
    const [playerX, playerO] = await Promise.all([
      playerRepository.updateStats(session.playerX.dbId, "draw"),
      playerRepository.updateStats(session.playerO.dbId, "draw"),
    ]);
    return { playerX, playerO };
  }

  if (outcome === "x_win") {
    const [winner, loser] = await Promise.all([
      playerRepository.updateStats(session.playerX.dbId, "win"),
      playerRepository.updateStats(session.playerO.dbId, "loss"),
    ]);
    return { winner, loser };
  }

  const [winner, loser] = await Promise.all([
    playerRepository.updateStats(session.playerO.dbId, "win"),
    playerRepository.updateStats(session.playerX.dbId, "loss"),
  ]);
  return { winner, loser };
}
