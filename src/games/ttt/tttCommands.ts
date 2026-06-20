/**
 * Handler de comandos do jogo da velha — integração com GameManager e ranking.
 */

import type { PlayerRepository } from "../../db/repositories/playerRepository.js";
import type { GameRepository } from "../../db/repositories/gameRepository.js";
import { logger } from "../../utils/logger.js";
import type { ActiveGameSession, GameHandlerContext, MiniGame } from "../types.js";
import {
  createInitialState,
  dbIdForSymbol,
  parseTttState,
  playMove,
  serializeTttState,
  symbolForKickUserId,
  usernameForSymbol,
  type TttSymbol,
} from "./tttGame.js";
import {
  renderBoard,
  renderDraw,
  renderForfeit,
  renderGameStart,
  renderStatusActive,
  renderStatusWaiting,
  renderTurn,
  renderWaiting,
  renderWin,
  TTT_HELP,
} from "./tttRenderer.js";

function sender(ctx: GameHandlerContext) {
  return {
    kickUserId: ctx.command.message.sender.id,
    username: ctx.command.message.sender.username,
    slug: ctx.command.message.sender.slug,
  };
}

function getTttState(session: ActiveGameSession) {
  return parseTttState(session.state);
}

function wrongGameTypeMessage(session: ActiveGameSession): string {
  const prefix = session.gameType === "demo" ? "demo" : session.gameType;
  return `Há uma partida !${prefix} ativa. Encerre com !${prefix} end antes de usar !ttt.`;
}

async function requireTttSession(
  session: ActiveGameSession | null,
  sendChat: GameHandlerContext["sendChat"],
  broadcasterId: number
): Promise<ActiveGameSession | null> {
  if (!session) return null;

  if (session.gameType !== "ttt") {
    await sendChat(broadcasterId, wrongGameTypeMessage(session));
    return null;
  }

  return session;
}

function applyStats(
  playerRepository: PlayerRepository,
  session: ActiveGameSession,
  outcome: "x_win" | "o_win" | "draw"
): void {
  if (!session.playerO) return;

  if (outcome === "draw") {
    playerRepository.updateStats(session.playerX.dbId, "draw");
    playerRepository.updateStats(session.playerO.dbId, "draw");
    return;
  }

  if (outcome === "x_win") {
    playerRepository.updateStats(session.playerX.dbId, "win");
    playerRepository.updateStats(session.playerO.dbId, "loss");
    return;
  }

  playerRepository.updateStats(session.playerX.dbId, "loss");
  playerRepository.updateStats(session.playerO.dbId, "win");
}

export function createTttGame(
  playerRepository: PlayerRepository,
  gameRepository: GameRepository
): MiniGame {
  async function handleJoin(ctx: GameHandlerContext): Promise<void> {
    const { command, gameManager, sendChat } = ctx;
    const player = sender(ctx);
    const existing = gameManager.getActiveSession(command.channelSlug);

    if (existing) {
      if (existing.gameType !== "ttt") {
        await sendChat(
          command.broadcasterId,
          `@${player.username} ${wrongGameTypeMessage(existing)}`
        );
        return;
      }

      if (existing.status === "active") {
        await sendChat(
          command.broadcasterId,
          `@${player.username} já há uma partida de jogo da velha em andamento. Use !ttt board.`
        );
        return;
      }

      try {
        const session = gameManager.joinGame({
          channelSlug: command.channelSlug,
          playerO: player,
        });

        const freshState = createInitialState(command.broadcasterId);
        gameManager.updateState(
          command.channelSlug,
          serializeTttState(freshState)
        );

        await sendChat(
          command.broadcasterId,
          renderGameStart(
            session.playerX.username,
            session.playerO!.username,
            freshState.board
          )
        );
        logger.info(`[TTT] ${player.username} entrou — partida ${session.id}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao entrar na partida.";
        await sendChat(command.broadcasterId, `@${player.username} ${message}`);
      }
      return;
    }

    const initialState = serializeTttState(
      createInitialState(command.broadcasterId)
    );

    gameManager.startGame({
      channelSlug: command.channelSlug,
      broadcasterId: command.broadcasterId,
      gameType: "ttt",
      playerX: player,
      initialState,
    });

    await sendChat(
      command.broadcasterId,
      renderWaiting(player.username)
    );
    logger.info(`[TTT] ${player.username} criou partida`);
  }

  async function handleMove(
    ctx: GameHandlerContext,
    position: number
  ): Promise<void> {
    const { command, gameManager, sendChat } = ctx;
    const player = sender(ctx);
    const rawSession = gameManager.getActiveSession(command.channelSlug);

    if (!rawSession) {
      await sendChat(
        command.broadcasterId,
        `@${player.username} nenhuma partida ativa. Use !ttt join.`
      );
      return;
    }

    const session = await requireTttSession(
      rawSession,
      sendChat,
      command.broadcasterId
    );
    if (!session || session.status !== "active" || !session.playerO) {
      if (session?.status === "waiting") {
        await sendChat(
          command.broadcasterId,
          `@${player.username} aguardando oponente. Outro jogador use !ttt join.`
        );
      }
      return;
    }

    const state = getTttState(session);
    if (!state) {
      logger.error(`[TTT] Estado inválido na partida ${session.id}`, session.state);
      const repaired = createInitialState(command.broadcasterId);
      gameManager.updateState(command.channelSlug, serializeTttState(repaired));
      await sendChat(
        command.broadcasterId,
        `@${player.username} tabuleiro reiniciado. ${renderTurn(session.playerX.username, repaired.board)}`
      );
      return;
    }

    const symbol = symbolForKickUserId(
      player.kickUserId,
      session.playerX.kickUserId,
      session.playerO.kickUserId
    );

    if (!symbol) {
      await sendChat(
        command.broadcasterId,
        `@${player.username} você não está nesta partida.`
      );
      return;
    }

    const result = playMove(state, position, symbol);
    if (!result.ok) {
      await sendChat(command.broadcasterId, `@${player.username} ${result.error}`);
      return;
    }

    gameManager.updateState(
      command.channelSlug,
      serializeTttState(result.state)
    );
    gameRepository.recordMove(session.id, symbol === "X" ? session.playerX.dbId : session.playerO!.dbId, position);

    if (result.status === "continue") {
      const nextUsername = usernameForSymbol(
        result.state.currentTurn,
        session.playerX.username,
        session.playerO.username
      );
      await sendChat(
        command.broadcasterId,
        renderTurn(nextUsername, result.state.board)
      );
      return;
    }

    if (result.status === "draw") {
      applyStats(playerRepository, session, "draw");
      await gameManager.endGame({
        channelSlug: command.channelSlug,
        reason: "finished",
        winnerDbId: null,
        boardState: serializeTttState(result.state),
        announceMessage: renderDraw(result.state.board),
      });
      logger.info(`[TTT] Empate — partida ${session.id}`);
      return;
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

    applyStats(
      playerRepository,
      session,
      winnerSymbol === "X" ? "x_win" : "o_win"
    );

    await gameManager.endGame({
      channelSlug: command.channelSlug,
      reason: "finished",
      winnerDbId,
      boardState: serializeTttState(result.state),
      announceMessage: renderWin(winnerName, result.state.board),
    });
    logger.info(`[TTT] ${winnerName} venceu — partida ${session.id}`);
  }

  async function handleBoard(ctx: GameHandlerContext): Promise<void> {
    const { command, gameManager, sendChat } = ctx;
    const rawSession = gameManager.getActiveSession(command.channelSlug);

    if (!rawSession) {
      await sendChat(command.broadcasterId, "Nenhuma partida ativa. Use !ttt join.");
      return;
    }

    const session = await requireTttSession(
      rawSession,
      sendChat,
      command.broadcasterId
    );
    if (!session) return;

    if (session.status === "waiting") {
      await sendChat(
        command.broadcasterId,
        renderStatusWaiting(session.playerX.username)
      );
      return;
    }

    const state = getTttState(session);
    if (!state || !session.playerO) {
      logger.error(`[TTT] Tabuleiro inválido na partida ${session.id}`, session.state);
      await sendChat(
        command.broadcasterId,
        "Tabuleiro indisponível. Encerre com !ttt forfeit e inicie nova partida com !ttt join."
      );
      return;
    }

    await sendChat(
      command.broadcasterId,
      renderStatusActive(
        session.playerX.username,
        session.playerO.username,
        state.currentTurn,
        state.board
      )
    );
  }

  async function handleForfeit(ctx: GameHandlerContext): Promise<void> {
    const { command, gameManager, sendChat } = ctx;
    const player = sender(ctx);
    const rawSession = gameManager.getActiveSession(command.channelSlug);

    if (!rawSession) {
      await sendChat(
        command.broadcasterId,
        `@${player.username} nenhuma partida ativa para desistir.`
      );
      return;
    }

    const session = await requireTttSession(
      rawSession,
      sendChat,
      command.broadcasterId
    );
    if (!session || session.status !== "active" || !session.playerO) {
      return;
    }

    const symbol = symbolForKickUserId(
      player.kickUserId,
      session.playerX.kickUserId,
      session.playerO.kickUserId
    );

    if (!symbol) {
      await sendChat(
        command.broadcasterId,
        `@${player.username} você não está nesta partida.`
      );
      return;
    }

    const winnerSymbol: TttSymbol = symbol === "X" ? "O" : "X";
    const winnerName = usernameForSymbol(
      winnerSymbol,
      session.playerX.username,
      session.playerO.username
    );
    const loserName = player.username;
    const winnerDbId = dbIdForSymbol(
      winnerSymbol,
      session.playerX.dbId,
      session.playerO.dbId
    );

    applyStats(
      playerRepository,
      session,
      winnerSymbol === "X" ? "x_win" : "o_win"
    );

    const state = getTttState(session);

    await gameManager.endGame({
      channelSlug: command.channelSlug,
      reason: "finished",
      winnerDbId,
      boardState: state ? serializeTttState(state) : session.state,
      announceMessage: renderForfeit(winnerName, loserName),
    });
    logger.info(`[TTT] ${loserName} desistiu — vitória de ${winnerName}`);
  }

  async function handleHelpOrStatus(ctx: GameHandlerContext): Promise<void> {
    const { command, gameManager, sendChat } = ctx;
    const rawSession = gameManager.getActiveSession(command.channelSlug);

    if (!rawSession) {
      await sendChat(command.broadcasterId, TTT_HELP);
      return;
    }

    const session = await requireTttSession(
      rawSession,
      sendChat,
      command.broadcasterId
    );
    if (!session) return;

    if (session.status === "waiting") {
      await sendChat(
        command.broadcasterId,
        renderStatusWaiting(session.playerX.username)
      );
      return;
    }

    const state = getTttState(session);
    if (!state || !session.playerO) {
      await sendChat(command.broadcasterId, TTT_HELP);
      return;
    }

    await sendChat(
      command.broadcasterId,
      renderStatusActive(
        session.playerX.username,
        session.playerO.username,
        state.currentTurn,
        state.board
      )
    );
  }

  return {
    name: "Jogo da Velha",
    commandPrefix: "ttt",
    async handle(ctx: GameHandlerContext): Promise<void> {
      const sub = ctx.parsed.subcommand;

      if (sub === "join") {
        await handleJoin(ctx);
        return;
      }

      if (sub === "board") {
        await handleBoard(ctx);
        return;
      }

      if (sub === "forfeit") {
        await handleForfeit(ctx);
        return;
      }

      if (sub === "help" || sub === "challenge") {
        if (sub === "challenge") {
          await ctx.sendChat(
            ctx.command.broadcasterId,
            `@${sender(ctx).username} !ttt challenge em breve. ${TTT_HELP}`
          );
          return;
        }
        await handleHelpOrStatus(ctx);
        return;
      }

      // !ttt 5 — jogada numérica
      if (!sub && ctx.parsed.args.length === 1) {
        const position = Number.parseInt(ctx.parsed.args[0] ?? "", 10);
        if (Number.isFinite(position)) {
          await handleMove(ctx, position);
          return;
        }
      }

      // !ttt sem args — ajuda ou status
      if (!sub) {
        await handleHelpOrStatus(ctx);
        return;
      }

      await ctx.sendChat(
        ctx.command.broadcasterId,
        `Comando ttt desconhecido. ${TTT_HELP}`
      );
    },
  };
}

export { renderBoard, TTT_HELP };
