/**
 * Formatação de mensagens de ranking para o chat Kick.
 */

import type { PlayerRecord } from "../db/types.js";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

export const RANK_HELP = "!rank | !rank me | !rank @usuario";

function formatStats(player: PlayerRecord): string {
  return `${player.points}pts (${player.wins}V/${player.draws}E/${player.losses}D)`;
}

export function renderTopRanking(players: PlayerRecord[], limit = 10): string {
  if (players.length === 0) {
    return "📊 Ranking vazio. Jogue !ttt join para aparecer aqui!";
  }

  const lines = players.map((player, index) => {
    const prefix =
      index < MEDALS.length ? MEDALS[index] : `${index + 1}.`;
    return `${prefix} ${player.username} — ${formatStats(player)}`;
  });

  return [`🏆 Top ${Math.min(players.length, limit)}:`, ...lines].join("\n");
}

export function renderPlayerProfile(
  player: PlayerRecord,
  isSelf = false
): string {
  const header = isSelf
    ? `📊 Suas stats, @${player.username}:`
    : `📊 Stats de @${player.username}:`;

  return `${header} ${formatStats(player)}`;
}

export function renderPlayerNotFound(query: string): string {
  return `Jogador "${query.replace(/^@/, "")}" não encontrado no ranking. ${RANK_HELP}`;
}
