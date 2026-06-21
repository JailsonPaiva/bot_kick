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

export function registerPlayer(
  playerRepository: PlayerRepository,
  player: ChatPlayer
): PlayerRecord {
  return playerRepository.findOrCreate({
    kick_user_id: player.kickUserId,
    username: player.username,
    slug: player.slug,
  });
}

export function registerSessionPlayers(
  playerRepository: PlayerRepository,
  session: ActiveGameSession
): void {
  registerPlayer(playerRepository, {
    kickUserId: session.playerX.kickUserId,
    username: session.playerX.username,
    slug: session.playerX.slug,
  });

  if (session.playerO) {
    registerPlayer(playerRepository, {
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

export function applyTttStats(
  playerRepository: PlayerRepository,
  session: ActiveGameSession,
  outcome: "x_win" | "o_win" | "draw"
): StatsOutcome {
  if (!session.playerO) return {};

  if (outcome === "draw") {
    return {
      playerX: playerRepository.updateStats(session.playerX.dbId, "draw"),
      playerO: playerRepository.updateStats(session.playerO.dbId, "draw"),
    };
  }

  if (outcome === "x_win") {
    return {
      winner: playerRepository.updateStats(session.playerX.dbId, "win"),
      loser: playerRepository.updateStats(session.playerO.dbId, "loss"),
    };
  }

  return {
    winner: playerRepository.updateStats(session.playerO.dbId, "win"),
    loser: playerRepository.updateStats(session.playerX.dbId, "loss"),
  };
}
