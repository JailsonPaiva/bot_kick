/**
 * Formatação do tabuleiro e mensagens do jogo da velha para o chat Kick.
 */

import type { Cell, TttSymbol } from "./tttGame.js";

export const TTT_HELP =
  "!ttt join — entra/cria partida | !ttt 1-9 — jogada | !ttt board — tabuleiro | !ttt forfeit — desistir";

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
  return [`@${username}, sua vez!`, renderBoard(board)].join("\n");
}

export function renderWin(winnerName: string, board: Cell[]): string {
  return [`🏆 ${winnerName} venceu!`, renderBoard(board)].join("\n");
}

export function renderDraw(board: Cell[]): string {
  return [`🤝 Empate!`, renderBoard(board)].join("\n");
}

export function renderForfeit(winnerName: string, loserName: string): string {
  return `🏳️ ${loserName} desistiu. ${winnerName} vence!`;
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
  ].join("\n");
}
