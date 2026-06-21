/**
 * Formatação do tabuleiro e mensagens do jogo da velha para o chat Kick.
 */

import type { PlayerRecord } from "../../db/types.js";
import type { Cell, TttSymbol } from "./tttGame.js";

export const TTT_HELP =
  "!ttt join | !ttt 1-9 | !ttt board | !ttt forfeit | !ttt help";

export const TTT_HELP_FULL = [
  "📋 Jogo da velha:",
  "1) !ttt join — cria ou entra na partida",
  "2) !ttt 1-9 — joga na posição do tabuleiro",
  "3) !ttt board — vê o tabuleiro",
  "4) !ttt forfeit — desiste",
  "Tabuleiro: posições 1-9 (centro = 5)",
].join(" | ");

function cellDisplay(board: Cell[], index: number): string {
  const value = board[index];
  return value ?? String(index + 1);
}

export function renderBoard(board: Cell[]): string {
  return [
    `${cellDisplay(board, 0)} | ${cellDisplay(board, 1)} | ${cellDisplay(board, 2)}`,
    "--+---+--",
    `${cellDisplay(board, 3)} | ${cellDisplay(board, 4)} | ${cellDisplay(board, 5)}`,
    "--+---+--",
    `${cellDisplay(board, 6)} | ${cellDisplay(board, 7)} | ${cellDisplay(board, 8)}`,
  ].join("\n");
}

export function renderPlayerStats(player: PlayerRecord): string {
  return `${player.username}: ${player.points}pts (${player.wins}V/${player.draws}E/${player.losses}D)`;
}

export function renderWaiting(hostUsername: string): string {
  return `@${hostUsername} aguarda oponente no jogo da velha! Use !ttt join para entrar.`;
}

export function renderGameStart(
  playerX: string,
  playerO: string,
  board: Cell[]
): string {
  return [
    `🎮 Jogo da velha: ${playerX} (X) vs ${playerO} (O)`,
    renderBoard(board),
    `@${playerX} começa! Use !ttt 1-9`,
  ].join("\n");
}

export function renderTurn(username: string, board: Cell[]): string {
  return [
    `@${username}, sua vez! Use !ttt 1-9`,
    renderBoard(board),
  ].join("\n");
}

export function renderWin(
  winnerName: string,
  board: Cell[],
  winnerStats?: PlayerRecord
): string {
  const lines = [`🏆 ${winnerName} venceu!`, renderBoard(board)];
  if (winnerStats) {
    lines.push(`+3 pts → ${renderPlayerStats(winnerStats)}`);
  }
  return lines.join("\n");
}

export function renderDraw(
  board: Cell[],
  playerXStats?: PlayerRecord,
  playerOStats?: PlayerRecord
): string {
  const lines = ["🤝 Empate!", renderBoard(board)];
  if (playerXStats && playerOStats) {
    lines.push(
      `+1 pt → ${renderPlayerStats(playerXStats)} | ${renderPlayerStats(playerOStats)}`
    );
  }
  return lines.join("\n");
}

export function renderForfeit(
  winnerName: string,
  loserName: string,
  winnerStats?: PlayerRecord
): string {
  const lines = [`🏳️ ${loserName} desistiu. ${winnerName} vence!`];
  if (winnerStats) {
    lines.push(`+3 pts → ${renderPlayerStats(winnerStats)}`);
  }
  return lines.join("\n");
}

export function renderStatusWaiting(hostUsername: string): string {
  return `Partida aguardando oponente. Host: ${hostUsername}. Use !ttt join.`;
}

export function renderStatusActive(
  playerX: string,
  playerO: string,
  currentTurn: TttSymbol,
  board: Cell[]
): string {
  const turnName = currentTurn === "X" ? playerX : playerO;
  return [
    `Partida: ${playerX} (X) vs ${playerO} (O) — vez de ${turnName}`,
    renderBoard(board),
    `Use !ttt 1-9 para jogar`,
  ].join("\n");
}
