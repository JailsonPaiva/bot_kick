/**
 * Repository de partidas — criação, consulta e finalização de jogos via Prisma/PostgreSQL.
 */

import { prisma } from "../../infra/prisma/client.js";
import type { CreateGameInput, GameRecord, GameStatus } from "../types.js";

function toRecord(g: {
  id: string;
  gameType: string;
  channelSlug: string;
  playerXId: string;
  playerOId: string;
  winnerId: string | null;
  status: string;
  boardState: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}): GameRecord {
  return {
    id: g.id,
    gameType: g.gameType,
    channelSlug: g.channelSlug,
    playerXId: g.playerXId,
    playerOId: g.playerOId,
    winnerId: g.winnerId,
    status: g.status as GameStatus,
    boardState: g.boardState,
    startedAt: g.startedAt,
    finishedAt: g.finishedAt,
  };
}

export class GameRepository {
  async create(input: CreateGameInput): Promise<GameRecord> {
    const g = await prisma.game.create({
      data: {
        id: input.id,
        gameType: input.gameType,
        channelSlug: input.channelSlug,
        playerXId: input.playerXId,
        playerOId: input.playerOId,
        status: "active",
        boardState: input.boardState ?? null,
      },
    });
    return toRecord(g);
  }

  async findById(id: string): Promise<GameRecord | null> {
    const g = await prisma.game.findUnique({ where: { id } });
    return g ? toRecord(g) : null;
  }

  async findActiveByChannel(channelSlug: string): Promise<GameRecord | null> {
    const g = await prisma.game.findFirst({
      where: { channelSlug, status: "active" },
      orderBy: { startedAt: "desc" },
    });
    return g ? toRecord(g) : null;
  }

  async findAllActive(): Promise<GameRecord[]> {
    const games = await prisma.game.findMany({
      where: { status: "active" },
      orderBy: { startedAt: "asc" },
    });
    return games.map(toRecord);
  }

  async updateBoardState(gameId: string, boardState: string): Promise<void> {
    await prisma.game.update({
      where: { id: gameId },
      data: { boardState },
    });
  }

  async finish(
    gameId: string,
    winnerId: string | null,
    boardState: string
  ): Promise<GameRecord> {
    const g = await prisma.game.update({
      where: { id: gameId },
      data: {
        status: "finished",
        winnerId,
        boardState,
        finishedAt: new Date(),
      },
    });
    return toRecord(g);
  }

  async abandon(gameId: string, boardState?: string): Promise<GameRecord> {
    const g = await prisma.game.update({
      where: { id: gameId },
      data: {
        status: "abandoned",
        finishedAt: new Date(),
        ...(boardState !== undefined ? { boardState } : {}),
      },
    });
    return toRecord(g);
  }

  async recordMove(
    gameId: string,
    playerId: string,
    position: number
  ): Promise<void> {
    await prisma.gameMove.create({
      data: { gameId, playerId, position },
    });
  }
}
