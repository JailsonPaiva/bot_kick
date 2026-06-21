/**
 * Handler de comandos do jogo da velha — integração com GameManager e ranking.
 */

import type { PlayerRepository } from "../../db/repositories/playerRepository.js";
import type { GameRepository } from "../../db/repositories/gameRepository.js";
import { logger } from "../../utils/logger.js";
import type { ActiveGameSession, GameHandlerContext, MiniGame } from "../types.js";
import {
  createInitialState,
  parseTttState,
  serializeTttState,
  symbolForKickUserId,
  usernameForSymbol,
  dbIdForSymbol,
  type TttSymbol,
} from "./tttGame.js";
import {
  renderBoard,
  renderForfeit,
  renderGameStart,
  renderStatusActive,
  renderStatusWaiting,
  renderWaiting,
  TTT_HELP,
  TTT_HELP_FULL,
} from "./tttRenderer.js";
import {
  applyTttStats,
  registerPlayer,
  registerSessionPlayers,
} from "./tttService.js";
import {
  broadcastSessionToPlayers,
  createPlayLinkForPlayer,
  executeTttMove,
} from "./tttPlayService.js";

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

function ensurePlayerRegistered(
  playerRepository: PlayerRepository,
  ctx: GameHandlerContext
): void {
  registerPlayer(playerRepository, sender(ctx));
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

        registerSessionPlayers(playerRepository, session);

        await sendChat(
          command.broadcasterId,
          renderGameStart(
            session.playerX.username,
            session.playerO!.username,
            freshState.board
          )
        );
        broadcastSessionToPlayers(session, "start");
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

    ensurePlayerRegistered(playerRepository, ctx);

    const waitingSession = gameManager.getActiveSession(command.channelSlug);
    if (waitingSession) {
      broadcastSessionToPlayers(waitingSession, "waiting");
    }

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

    const result = await executeTttMove(
      { gameManager, gameRepository, playerRepository },
      command.channelSlug,
      player,
      position
    );

    if (!result.ok) {
      await sendChat(
        command.broadcasterId,
        `@${player.username} ${result.error}`
      );
      return;
    }

    const stillActive = gameManager.getActiveSession(command.channelSlug);
    if (stillActive && result.announceMessage) {
      await sendChat(command.broadcasterId, result.announceMessage);
    }
  }

  async function handleWeb(ctx: GameHandlerContext): Promise<void> {
    const { command, gameManager, sendChat } = ctx;
    const player = sender(ctx);
    const session = gameManager.getActiveSession(command.channelSlug);

    if (!session || session.gameType !== "ttt") {
      await sendChat(
        command.broadcasterId,
        `@${player.username} nenhuma partida ativa. Use !ttt join.`
      );
      return;
    }

    const isPlayer =
      session.playerX.kickUserId === player.kickUserId ||
      session.playerO?.kickUserId === player.kickUserId;

    if (!isPlayer) {
      await sendChat(
        command.broadcasterId,
        `@${player.username} você não está nesta partida.`
      );
      return;
    }

    const link = createPlayLinkForPlayer(session, player);
    if (!link) {
      await sendChat(
        command.broadcasterId,
        `@${player.username} não foi possível gerar o link da web.`
      );
      return;
    }

    await sendChat(
      command.broadcasterId,
      `@${player.username} jogue pela web (válido por 10 min): ${link}`
    );
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

    const stats = applyTttStats(
      playerRepository,
      session,
      winnerSymbol === "X" ? "x_win" : "o_win"
    );

    const state = getTttState(session);

    broadcastSessionToPlayers(session, "end");

    await gameManager.endGame({
      channelSlug: command.channelSlug,
      reason: "finished",
      winnerDbId,
      boardState: state ? serializeTttState(state) : session.state,
      announceMessage: renderForfeit(winnerName, loserName, stats.winner),
    });
    logger.info(`[TTT] ${loserName} desistiu — vitória de ${winnerName}`);
  }

  async function handleHelp(ctx: GameHandlerContext): Promise<void> {
    await ctx.sendChat(ctx.command.broadcasterId, TTT_HELP_FULL);
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

      if (sub === "web") {
        await handleWeb(ctx);
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
        await handleHelp(ctx);
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
