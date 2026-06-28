/**
 * Lógica compartilhada entre chat e interface web do jogo da velha.
 */

import type { GameRepository } from "../../db/repositories/gameRepository.js";
import type { PlayerRepository } from "../../db/repositories/playerRepository.js";
import type { ActiveGameSession } from "../types.js";
import type { GameManager } from "../engine/gameManager.js";
import { broadcastGameUpdate } from "../../api/gameEvents.js";
import { generatePlayerToken, buildPlayUrl } from "../../api/playerAuth.js";
import type { TttSymbol, Cell } from "./tttGame.js";
import {
  createInitialState,
  dbIdForSymbol,
  parseTttState,
  playMove,
  serializeTttState,
  symbolForKickUserId,
  usernameForSymbol,
} from "./tttGame.js";
import {
  renderDraw,
  renderTurn,
  renderWin,
} from "./tttRenderer.js";
import { applyTttStats } from "./tttService.js";

export interface ChatPlayer {
  kickUserId: number;
  username: string;
  slug: string;
}

export interface GameFinishOutcome {
  winner: TttSymbol | null;
  winnerUsername: string | null;
  reason: "win" | "draw" | "forfeit";
}

export interface PlayGameView {
  gameId: string;
  channelSlug: string;
  status: "waiting" | "active" | "finished";
  playerX: { username: string; kickUserId: number; symbol: "X" };
  playerO: { username: string; kickUserId: number; symbol: "O" } | null;
  board: Cell[];
  currentTurn: TttSymbol;
  yourSymbol: TttSymbol | null;
  isYourTurn: boolean;
  winner: TttSymbol | null;
  winnerUsername: string | null;
  finishedReason: "win" | "draw" | "forfeit" | null;
}

export function buildPlayGameView(
  session: ActiveGameSession | null,
  viewerKickUserId: number,
  outcome?: GameFinishOutcome
): PlayGameView | null {
  if (!session || session.gameType !== "ttt") return null;

  const state = parseTttState(session.state);
  const yourSymbol = symbolForKickUserId(
    viewerKickUserId,
    session.playerX.kickUserId,
    session.playerO?.kickUserId
  );

  const isFinished = Boolean(outcome);

  return {
    gameId: session.id,
    channelSlug: session.channelSlug,
    status: isFinished ? "finished" : session.status,
    playerX: {
      username: session.playerX.username,
      kickUserId: session.playerX.kickUserId,
      symbol: "X",
    },
    playerO: session.playerO
      ? {
          username: session.playerO.username,
          kickUserId: session.playerO.kickUserId,
          symbol: "O",
        }
      : null,
    board: state?.board ?? Array<Cell>(9).fill(null),
    currentTurn: state?.currentTurn ?? "X",
    yourSymbol,
    isYourTurn: isFinished
      ? false
      : Boolean(state && yourSymbol && state.currentTurn === yourSymbol),
    winner: outcome?.winner ?? null,
    winnerUsername: outcome?.winnerUsername ?? null,
    finishedReason: outcome?.reason ?? null,
  };
}

export function broadcastSessionUpdate(
  session: ActiveGameSession | null,
  viewerKickUserId: number,
  event: "start" | "move" | "end" | "waiting" = "move",
  outcome?: GameFinishOutcome
): void {
  if (!session) return;

  const view = buildPlayGameView(session, viewerKickUserId, outcome);
  if (!view) return;

  broadcastGameUpdate(session.channelSlug, viewerKickUserId, view, event);
}

export function broadcastSessionToPlayers(
  session: ActiveGameSession,
  event: "start" | "move" | "end" | "waiting" = "move",
  outcome?: GameFinishOutcome
): void {
  broadcastSessionUpdate(session, session.playerX.kickUserId, event, outcome);
  if (session.playerO) {
    broadcastSessionUpdate(session, session.playerO.kickUserId, event, outcome);
  }
}

export function createPlayTokenForPlayer(
  session: ActiveGameSession,
  player: ChatPlayer
): string | null {
  const symbol = symbolForKickUserId(
    player.kickUserId,
    session.playerX.kickUserId,
    session.playerO?.kickUserId
  );

  if (!symbol && player.kickUserId !== session.playerX.kickUserId) {
    return null;
  }

  return generatePlayerToken({
    kickUserId: player.kickUserId,
    username: player.username,
    slug: player.slug,
    channelSlug: session.channelSlug,
    gameId: session.id,
    symbol,
  });
}

export function createPlayLinkForPlayer(
  session: ActiveGameSession,
  player: ChatPlayer
): string | null {
  const token = createPlayTokenForPlayer(session, player);
  if (!token) return null;
  return buildPlayUrl(token);
}

export interface TttMoveDeps {
  gameManager: GameManager;
  gameRepository: GameRepository;
  playerRepository: PlayerRepository;
}

export type TttMoveResult =
  | {
      ok: true;
      announceMessage?: string;
      session: ActiveGameSession;
      outcome?: GameFinishOutcome;
    }
  | { ok: false; error: string };

export async function executeTttMove(
  deps: TttMoveDeps,
  channelSlug: string,
  player: ChatPlayer,
  position: number
): Promise<TttMoveResult> {
  const { gameManager, gameRepository, playerRepository } = deps;
  const session = gameManager.getActiveSession(channelSlug);

  if (!session) {
    return { ok: false, error: "Nenhuma partida ativa. Use !ttt join." };
  }

  if (session.gameType !== "ttt") {
    return { ok: false, error: "Partida ativa não é jogo da velha." };
  }

  if (session.status !== "active" || !session.playerO) {
    return {
      ok: false,
      error: "Aguardando oponente. Outro jogador use !ttt join.",
    };
  }

  let state = parseTttState(session.state);
  if (!state) {
    const repaired = createInitialState(session.broadcasterId);
    await gameManager.updateState(channelSlug, serializeTttState(repaired));
    return {
      ok: false,
      error: "Tabuleiro reiniciado. Tente novamente.",
    };
  }

  const symbol = symbolForKickUserId(
    player.kickUserId,
    session.playerX.kickUserId,
    session.playerO.kickUserId
  );

  if (!symbol) {
    return { ok: false, error: "Você não está nesta partida." };
  }

  const result = playMove(state, position, symbol);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await gameManager.updateState(channelSlug, serializeTttState(result.state));
  await gameRepository.recordMove(
    session.id,
    symbol === "X" ? session.playerX.dbId : session.playerO.dbId,
    position
  );

  const updatedSession = gameManager.getActiveSession(channelSlug)!;

  if (result.status === "continue") {
    const nextUsername = usernameForSymbol(
      result.state.currentTurn,
      session.playerX.username,
      session.playerO.username
    );
    const announceMessage = renderTurn(nextUsername, result.state.board);
    broadcastSessionToPlayers(updatedSession, "move");
    return { ok: true, announceMessage, session: updatedSession };
  }

  if (result.status === "draw") {
    const stats = await applyTttStats(playerRepository, session, "draw");
    const announceMessage = renderDraw(
      result.state.board,
      stats.playerX,
      stats.playerO
    );
    const outcome: GameFinishOutcome = {
      winner: null,
      winnerUsername: null,
      reason: "draw",
    };
    await gameManager.endGame({
      channelSlug,
      reason: "finished",
      winnerDbId: null,
      boardState: serializeTttState(result.state),
      announceMessage,
    });
    broadcastSessionToPlayers(updatedSession, "end", outcome);
    return { ok: true, announceMessage, session: updatedSession, outcome };
  }

  const winnerSymbol = result.winner;
  const winnerName = usernameForSymbol(
    winnerSymbol,
    session.playerX.username,
    session.playerO.username
  );
  const winnerDbId = dbIdForSymbol(
    winnerSymbol,
    session.playerX.dbId,
    session.playerO.dbId
  );

  const stats = await applyTttStats(
    playerRepository,
    session,
    winnerSymbol === "X" ? "x_win" : "o_win"
  );

  const announceMessage = renderWin(
    winnerName,
    result.state.board,
    stats.winner
  );

  const outcome: GameFinishOutcome = {
    winner: winnerSymbol,
    winnerUsername: winnerName,
    reason: "win",
  };

  await gameManager.endGame({
    channelSlug,
    reason: "finished",
    winnerDbId,
    boardState: serializeTttState(result.state),
    announceMessage,
  });
  broadcastSessionToPlayers(updatedSession, "end", outcome);
  return { ok: true, announceMessage, session: updatedSession, outcome };
}
