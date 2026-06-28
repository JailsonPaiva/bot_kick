/**
 * Repository de jogadores — CRUD e estatísticas de ranking via Prisma/PostgreSQL.
 */

import { prisma } from "../../infra/prisma/client.js";
import type { CreatePlayerInput, GameResult, PlayerRecord } from "../types.js";

const POINTS: Record<GameResult, number> = {
  win: 3,
  loss: 0,
  draw: 1,
};

function toRecord(p: {
  id: string;
  kickUserId: bigint;
  username: string;
  slug: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
}): PlayerRecord {
  return {
    id: p.id,
    kickUserId: Number(p.kickUserId),
    username: p.username,
    slug: p.slug,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    points: p.points,
  };
}

export class PlayerRepository {
  async findByKickUserId(kickUserId: number): Promise<PlayerRecord | null> {
    const p = await prisma.player.findUnique({
      where: { kickUserId: BigInt(kickUserId) },
    });
    return p ? toRecord(p) : null;
  }

  async findById(id: string): Promise<PlayerRecord | null> {
    const p = await prisma.player.findUnique({ where: { id } });
    return p ? toRecord(p) : null;
  }

  async findOrCreate(input: CreatePlayerInput): Promise<PlayerRecord> {
    const p = await prisma.player.upsert({
      where: { kickUserId: BigInt(input.kickUserId) },
      update: { username: input.username, slug: input.slug },
      create: {
        kickUserId: BigInt(input.kickUserId),
        username: input.username,
        slug: input.slug,
      },
    });
    return toRecord(p);
  }

  async updateStats(playerId: string, result: GameResult): Promise<PlayerRecord> {
    const pointsDelta = POINTS[result];
    const p = await prisma.player.update({
      where: { id: playerId },
      data: {
        wins:   result === "win"  ? { increment: 1 } : undefined,
        losses: result === "loss" ? { increment: 1 } : undefined,
        draws:  result === "draw" ? { increment: 1 } : undefined,
        points: { increment: pointsDelta },
      },
    });
    return toRecord(p);
  }

  async getTopN(limit: number): Promise<PlayerRecord[]> {
    const players = await prisma.player.findMany({
      orderBy: [{ points: "desc" }, { wins: "desc" }, { id: "asc" }],
      take: limit,
    });
    return players.map(toRecord);
  }

  async findByUsernameOrSlug(query: string): Promise<PlayerRecord | null> {
    const normalized = query.replace(/^@/, "").trim().toLowerCase();
    if (!normalized) return null;

    const p = await prisma.player.findFirst({
      where: {
        OR: [
          { username: { equals: normalized, mode: "insensitive" } },
          { slug: { equals: normalized, mode: "insensitive" } },
        ],
      },
    });
    return p ? toRecord(p) : null;
  }
}
