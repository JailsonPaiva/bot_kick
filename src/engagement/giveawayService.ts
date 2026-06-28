/**
 * Serviço de sorteios (Fase 4).
 */

import { randomInt } from "node:crypto";
import { prisma } from "../infra/prisma/client.js";

export interface GiveawayUser {
  kickUserId: number;
  username: string;
  slug: string;
  badges: Array<{ type: string; text: string }>;
}

function normalizeFilter(filterType: string): string {
  const value = filterType.toLowerCase();
  if (value === "subscribers" || value === "followers" || value === "both") return value;
  return "everyone";
}

function canEnter(filterType: string, badges: GiveawayUser["badges"]): boolean {
  if (filterType === "everyone" || filterType === "followers") return true;
  const isSub = badges.some((b) => {
    const t = b.type.toLowerCase();
    return t === "subscriber" || t === "broadcaster";
  });
  if (filterType === "subscribers" || filterType === "both") return isSub;
  return true;
}

export class GiveawayService {
  async create(
    channelSlug: string,
    prize: string,
    filterType = "everyone",
    costPoints = 0
  ) {
    const existing = await this.getOpen(channelSlug);
    if (existing) {
      throw new Error("Já existe um sorteio aberto neste canal.");
    }

    return prisma.giveaway.create({
      data: {
        channelSlug,
        prize,
        filterType: normalizeFilter(filterType),
        costPoints: Math.max(0, Math.floor(costPoints)),
        status: "open",
      },
    });
  }

  async getOpen(channelSlug: string) {
    return prisma.giveaway.findFirst({
      where: { channelSlug, status: "open" },
      orderBy: { createdAt: "desc" },
      include: { entries: true },
    });
  }

  async listRecent(channelSlug: string, limit = 20) {
    return prisma.giveaway.findMany({
      where: { channelSlug },
      orderBy: { createdAt: "desc" },
      include: { entries: true },
      take: limit,
    });
  }

  async enterOpen(channelSlug: string, user: GiveawayUser): Promise<{ ok: true; entries: number } | { ok: false; error: string }> {
    const giveaway = await this.getOpen(channelSlug);
    if (!giveaway) return { ok: false, error: "Nenhum sorteio aberto no momento." };

    if (!canEnter(giveaway.filterType, user.badges)) {
      return { ok: false, error: "Você não atende aos requisitos deste sorteio." };
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (giveaway.costPoints > 0) {
          const viewer = await tx.viewerPoints.findUnique({
            where: {
              channelSlug_kickUserId: {
                channelSlug,
                kickUserId: BigInt(user.kickUserId),
              },
            },
          });

          if (!viewer || viewer.balance < giveaway.costPoints) {
            throw new Error("Saldo insuficiente para entrar neste sorteio.");
          }

          await tx.viewerPoints.update({
            where: { id: viewer.id },
            data: { balance: { decrement: giveaway.costPoints } },
          });

          await tx.pointTransaction.create({
            data: {
              channelSlug,
              kickUserId: BigInt(user.kickUserId),
              amount: -giveaway.costPoints,
              type: "giveaway_entry",
              reason: `Entrada no sorteio ${giveaway.id}`,
            },
          });
        }

        await tx.giveawayEntry.create({
          data: {
            giveawayId: giveaway.id,
            kickUserId: BigInt(user.kickUserId),
            username: user.username,
            slug: user.slug,
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unique constraint")) {
        return { ok: false, error: "Você já está participando deste sorteio." };
      }
      return { ok: false, error: message };
    }

    const entriesCount = await prisma.giveawayEntry.count({
      where: { giveawayId: giveaway.id },
    });

    return { ok: true, entries: entriesCount };
  }

  async draw(channelSlug: string): Promise<
    | { ok: false; error: string }
    | { ok: true; winner: { kickUserId: number; username: string } | null; giveawayId: string; entries: number; prize: string }
  > {
    const giveaway = await this.getOpen(channelSlug);
    if (!giveaway) return { ok: false, error: "Nenhum sorteio aberto para encerrar." };

    const entries = await prisma.giveawayEntry.findMany({
      where: { giveawayId: giveaway.id },
      orderBy: { createdAt: "asc" },
    });

    if (entries.length === 0) {
      await prisma.giveaway.update({
        where: { id: giveaway.id },
        data: { status: "closed", closedAt: new Date(), winnerKickUserId: null },
      });
      return {
        ok: true,
        winner: null,
        giveawayId: giveaway.id,
        entries: 0,
        prize: giveaway.prize,
      };
    }

    const winner = entries[randomInt(entries.length)]!;

    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        status: "closed",
        closedAt: new Date(),
        winnerKickUserId: winner.kickUserId,
      },
    });

    return {
      ok: true,
      winner: { kickUserId: Number(winner.kickUserId), username: winner.username },
      giveawayId: giveaway.id,
      entries: entries.length,
      prize: giveaway.prize,
    };
  }

  async reroll(channelSlug: string): Promise<
    | { ok: false; error: string }
    | { ok: true; winner: { kickUserId: number; username: string }; giveawayId: string; prize: string }
  > {
    const giveaway = await prisma.giveaway.findFirst({
      where: { channelSlug, status: "closed" },
      orderBy: { closedAt: "desc" },
    });
    if (!giveaway) return { ok: false, error: "Nenhum sorteio encerrado para reroll." };

    const entries = await prisma.giveawayEntry.findMany({
      where: {
        giveawayId: giveaway.id,
        ...(giveaway.winnerKickUserId
          ? { kickUserId: { not: giveaway.winnerKickUserId } }
          : {}),
      },
    });

    if (entries.length === 0) {
      return { ok: false, error: "Não há participantes suficientes para reroll." };
    }

    const winner = entries[randomInt(entries.length)]!;

    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { winnerKickUserId: winner.kickUserId },
    });

    return {
      ok: true,
      winner: { kickUserId: Number(winner.kickUserId), username: winner.username },
      giveawayId: giveaway.id,
      prize: giveaway.prize,
    };
  }
}

export const giveawayService = new GiveawayService();
