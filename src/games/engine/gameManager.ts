/**
 * Orquestrador de partidas ativas — memória, persistência SQLite e timeout.
 */

import { randomUUID } from "node:crypto";
import { gameConfig } from "../../config/gameConfig.js";
import { GameRepository } from "../../db/repositories/gameRepository.js";
import { PlayerRepository } from "../../db/repositories/playerRepository.js";
import { logger } from "../../utils/logger.js";
import { parseTttState } from "../ttt/tttGame.js";
import type {
  ActiveGameSession,
  EndGameParams,
  JoinGameParams,
  SendChatFn,
  SessionPlayer,
  StartGameParams,
} from "../types.js";

export class GameManager {
  private sessions = new Map<string, ActiveGameSession>();
  private gameRepository: GameRepository;
  private playerRepository: PlayerRepository;
  private sendChat: SendChatFn;

  constructor(
    gameRepository: GameRepository,
    playerRepository: PlayerRepository,
    sendChat: SendChatFn
  ) {
    this.gameRepository = gameRepository;
    this.playerRepository = playerRepository;
    this.sendChat = sendChat;
  }

  recoverActiveGames(defaultBroadcasterId?: number): void {
    if (!gameConfig.recoverGamesOnBoot) {
      logger.info("Recuperação de partidas desabilitada (RECOVER_GAMES_ON_BOOT=false)");
      return;
    }

    const activeRecords = this.gameRepository.findAllActive();
    if (activeRecords.length === 0) {
      logger.info("Nenhuma partida active para recuperar");
      return;
    }

    const seenChannels = new Set<string>();
    let recovered = 0;
    let abandoned = 0;

    for (const record of activeRecords) {
      if (seenChannels.has(record.channel_slug)) {
        logger.warn(
          `Partida ${record.id} cancelada por restart (duplicata no canal ${record.channel_slug})`
        );
        this.gameRepository.abandon(record.id);
        abandoned++;
        continue;
      }

      if (record.game_type !== "ttt") {
        logger.warn(
          `Partida ${record.id} cancelada por restart (tipo ${record.game_type} não recuperável)`
        );
        this.gameRepository.abandon(record.id);
        abandoned++;
        continue;
      }

      const playerX = this.playerRepository.findById(record.player_x_id);
      const playerO = this.playerRepository.findById(record.player_o_id);

      if (!playerX || !playerO) {
        logger.warn(`Partida ${record.id} cancelada por restart (jogadores inválidos no banco)`);
        this.gameRepository.abandon(record.id);
        abandoned++;
        continue;
      }

      let state: Record<string, unknown> = {};
      if (record.board_state) {
        try {
          state = JSON.parse(record.board_state) as Record<string, unknown>;
        } catch {
          logger.warn(`Partida ${record.id} cancelada por restart (board_state corrompido)`);
          this.gameRepository.abandon(record.id);
          abandoned++;
          continue;
        }
      }

      if (!parseTttState(state)) {
        logger.warn(`Partida ${record.id} cancelada por restart (estado ttt inválido)`);
        this.gameRepository.abandon(record.id);
        abandoned++;
        continue;
      }

      const broadcasterId =
        typeof state.broadcasterId === "number" && state.broadcasterId > 0
          ? state.broadcasterId
          : (defaultBroadcasterId ?? 0);

      const session: ActiveGameSession = {
        id: record.id,
        gameType: record.game_type,
        channelSlug: record.channel_slug,
        broadcasterId,
        playerX: this.toSessionPlayer(playerX),
        playerO: this.toSessionPlayer(playerO),
        state,
        status: "active",
        lastActivityAt: Date.now(),
        timeoutHandle: null,
        persisted: true,
      };

      this.sessions.set(record.channel_slug, session);
      seenChannels.add(record.channel_slug);
      this.scheduleTimeout(session);
      recovered++;
      logger.info(
        `Partida recuperada: ${record.id} (ttt) — ${session.playerX.username} vs ${playerO.username}`
      );
    }

    logger.info(
      `Recuperação concluída: ${recovered} partida(s) retomada(s), ${abandoned} cancelada(s)`
    );
  }

  getActiveSession(channelSlug: string): ActiveGameSession | null {
    return this.sessions.get(channelSlug) ?? null;
  }

  hasActiveSession(channelSlug: string): boolean {
    return this.sessions.has(channelSlug);
  }

  startGame(params: StartGameParams): ActiveGameSession {
    if (this.sessions.has(params.channelSlug)) {
      throw new Error("Já existe uma partida ativa neste canal.");
    }

    const playerXRecord = this.playerRepository.findOrCreate({
      kick_user_id: params.playerX.kickUserId,
      username: params.playerX.username,
      slug: params.playerX.slug,
    });

    const session: ActiveGameSession = {
      id: randomUUID(),
      gameType: params.gameType,
      channelSlug: params.channelSlug,
      broadcasterId: params.broadcasterId,
      playerX: this.toSessionPlayer(playerXRecord),
      playerO: null,
      state: {
        ...params.initialState,
        broadcasterId: params.broadcasterId,
      },
      status: "waiting",
      lastActivityAt: Date.now(),
      timeoutHandle: null,
      persisted: false,
    };

    this.sessions.set(params.channelSlug, session);
    this.scheduleTimeout(session);
    logger.info(`Partida iniciada (aguardando oponente): ${session.id} [${params.gameType}]`);

    return session;
  }

  joinGame(params: JoinGameParams): ActiveGameSession {
    const session = this.sessions.get(params.channelSlug);
    if (!session) {
      throw new Error("Nenhuma partida aguardando oponente neste canal.");
    }

    if (session.status !== "waiting" || session.playerO !== null) {
      throw new Error("Esta partida não está aguardando oponente.");
    }

    if (session.playerX.kickUserId === params.playerO.kickUserId) {
      throw new Error("Você não pode entrar na sua própria partida.");
    }

    const playerORecord = this.playerRepository.findOrCreate({
      kick_user_id: params.playerO.kickUserId,
      username: params.playerO.username,
      slug: params.playerO.slug,
    });

    session.playerO = this.toSessionPlayer(playerORecord);
    session.status = "active";
    session.lastActivityAt = Date.now();

    this.gameRepository.create({
      id: session.id,
      game_type: session.gameType,
      channel_slug: session.channelSlug,
      player_x_id: session.playerX.dbId,
      player_o_id: session.playerO.dbId,
      board_state: JSON.stringify(session.state),
    });

    session.persisted = true;
    this.resetTimeout(session);
    logger.info(`Oponente entrou na partida ${session.id}`);

    return session;
  }

  touchActivity(channelSlug: string): void {
    const session = this.sessions.get(channelSlug);
    if (!session) return;

    session.lastActivityAt = Date.now();
    this.resetTimeout(session);
  }

  updateState(channelSlug: string, state: Record<string, unknown>): void {
    const session = this.sessions.get(channelSlug);
    if (!session) return;

    session.state = state;
    session.lastActivityAt = Date.now();

    if (session.persisted) {
      this.gameRepository.updateBoardState(session.id, JSON.stringify(state));
    }

    this.resetTimeout(session);
  }

  async endGame(params: EndGameParams): Promise<void> {
    const session = this.sessions.get(params.channelSlug);
    if (!session) {
      throw new Error("Nenhuma partida ativa neste canal.");
    }

    this.clearTimeout(session);

    const boardJson = JSON.stringify(params.boardState ?? session.state);

    if (session.persisted) {
      if (params.reason === "finished") {
        this.gameRepository.finish(
          session.id,
          params.winnerDbId ?? null,
          boardJson
        );
      } else {
        this.gameRepository.abandon(session.id, boardJson);
      }
    }

    this.sessions.delete(params.channelSlug);
    logger.info(`Partida encerrada (${params.reason}): ${session.id}`);

    if (params.announceMessage && session.broadcasterId > 0) {
      await this.sendChat(session.broadcasterId, params.announceMessage);
    }
  }

  shutdown(): void {
    for (const session of this.sessions.values()) {
      this.clearTimeout(session);
    }
    this.sessions.clear();
    logger.info("GameManager encerrado");
  }

  private toSessionPlayer(player: {
    id: number;
    kick_user_id: number;
    username: string;
    slug: string;
  }): SessionPlayer {
    return {
      dbId: player.id,
      kickUserId: player.kick_user_id,
      username: player.username,
      slug: player.slug,
    };
  }

  private scheduleTimeout(session: ActiveGameSession): void {
    this.clearTimeout(session);

    session.timeoutHandle = setTimeout(() => {
      void this.handleTimeout(session.channelSlug);
    }, gameConfig.gameTimeoutMs);
  }

  private resetTimeout(session: ActiveGameSession): void {
    this.scheduleTimeout(session);
  }

  private clearTimeout(session: ActiveGameSession): void {
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
      session.timeoutHandle = null;
    }
  }

  private async handleTimeout(channelSlug: string): Promise<void> {
    const session = this.sessions.get(channelSlug);
    if (!session) return;

    logger.warn(`Partida expirou por inatividade: ${session.id}`);

    try {
      await this.endGame({
        channelSlug,
        reason: "timeout",
        announceMessage: "⏱️ Partida cancelada por inatividade.",
      });
    } catch (err) {
      logger.error("Erro ao encerrar partida por timeout", err);
    }
  }
}
