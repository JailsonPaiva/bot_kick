/**
 * Orquestrador de partidas ativas — memória, persistência PostgreSQL e timeout.
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

  async recoverActiveGames(defaultBroadcasterId?: number): Promise<void> {
    if (!gameConfig.recoverGamesOnBoot) {
      logger.info("Recuperação de partidas desabilitada (RECOVER_GAMES_ON_BOOT=false)");
      return;
    }

    const activeRecords = await this.gameRepository.findAllActive();
    if (activeRecords.length === 0) {
      logger.info("Nenhuma partida active para recuperar");
      return;
    }

    const seenChannels = new Set<string>();
    let recovered = 0;
    let abandoned = 0;

    for (const record of activeRecords) {
      if (seenChannels.has(record.channelSlug)) {
        logger.warn(`Partida ${record.id} cancelada por restart (duplicata no canal ${record.channelSlug})`);
        await this.gameRepository.abandon(record.id);
        abandoned++;
        continue;
      }

      if (record.gameType !== "ttt") {
        logger.warn(`Partida ${record.id} cancelada por restart (tipo ${record.gameType} não recuperável)`);
        await this.gameRepository.abandon(record.id);
        abandoned++;
        continue;
      }

      const [playerX, playerO] = await Promise.all([
        this.playerRepository.findById(record.playerXId),
        this.playerRepository.findById(record.playerOId),
      ]);

      if (!playerX || !playerO) {
        logger.warn(`Partida ${record.id} cancelada por restart (jogadores inválidos no banco)`);
        await this.gameRepository.abandon(record.id);
        abandoned++;
        continue;
      }

      let state: Record<string, unknown> = {};
      if (record.boardState) {
        try {
          state = JSON.parse(record.boardState) as Record<string, unknown>;
        } catch {
          logger.warn(`Partida ${record.id} cancelada por restart (boardState corrompido)`);
          await this.gameRepository.abandon(record.id);
          abandoned++;
          continue;
        }
      }

      if (!parseTttState(state)) {
        logger.warn(`Partida ${record.id} cancelada por restart (estado ttt inválido)`);
        await this.gameRepository.abandon(record.id);
        abandoned++;
        continue;
      }

      const broadcasterId =
        typeof state.broadcasterId === "number" && state.broadcasterId > 0
          ? state.broadcasterId
          : (defaultBroadcasterId ?? 0);

      const session: ActiveGameSession = {
        id: record.id,
        gameType: record.gameType,
        channelSlug: record.channelSlug,
        broadcasterId,
        playerX: this.toSessionPlayer(playerX),
        playerO: this.toSessionPlayer(playerO),
        state,
        status: "active",
        lastActivityAt: Date.now(),
        timeoutHandle: null,
        persisted: true,
      };

      this.sessions.set(record.channelSlug, session);
      seenChannels.add(record.channelSlug);
      this.scheduleTimeout(session);
      recovered++;
      logger.info(`Partida recuperada: ${record.id} (ttt) — ${playerX.username} vs ${playerO.username}`);
    }

    logger.info(`Recuperação concluída: ${recovered} partida(s) retomada(s), ${abandoned} cancelada(s)`);
  }

  getActiveSession(channelSlug: string): ActiveGameSession | null {
    return this.sessions.get(channelSlug) ?? null;
  }

  hasActiveSession(channelSlug: string): boolean {
    return this.sessions.has(channelSlug);
  }

  async startGame(params: StartGameParams): Promise<ActiveGameSession> {
    if (this.sessions.has(params.channelSlug)) {
      throw new Error("Já existe uma partida ativa neste canal.");
    }

    const playerXRecord = await this.playerRepository.findOrCreate({
      kickUserId: params.playerX.kickUserId,
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
        ...(params.initialState ?? {}),
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

  async joinGame(params: JoinGameParams): Promise<ActiveGameSession> {
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

    const playerORecord = await this.playerRepository.findOrCreate({
      kickUserId: params.playerO.kickUserId,
      username: params.playerO.username,
      slug: params.playerO.slug,
    });

    session.playerO = this.toSessionPlayer(playerORecord);
    session.status = "active";
    session.lastActivityAt = Date.now();

    await this.gameRepository.create({
      id: session.id,
      gameType: session.gameType,
      channelSlug: session.channelSlug,
      playerXId: session.playerX.dbId,
      playerOId: session.playerO.dbId,
      boardState: JSON.stringify(session.state),
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

  async updateState(channelSlug: string, state: Record<string, unknown>): Promise<void> {
    const session = this.sessions.get(channelSlug);
    if (!session) return;

    session.state = state;
    session.lastActivityAt = Date.now();

    if (session.persisted) {
      await this.gameRepository.updateBoardState(session.id, JSON.stringify(state));
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
        await this.gameRepository.finish(session.id, params.winnerDbId ?? null, boardJson);
      } else {
        await this.gameRepository.abandon(session.id, boardJson);
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
    id: string;
    kickUserId: number;
    username: string;
    slug: string;
  }): SessionPlayer {
    return {
      dbId: player.id,
      kickUserId: player.kickUserId,
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
