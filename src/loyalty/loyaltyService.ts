/**
 * Serviço de loyalty points (Fase 3).
 * Mantém saldo por canal/usuário e registra transações.
 */

import { prisma } from "../infra/prisma/client.js";
import type { ChatMessage } from "../chat/types.js";

const POINTS_PER_ACTIVITY = Number.parseInt(
  process.env.LOYALTY_POINTS_PER_ACTIVITY ?? "1",
  10
);
const ACTIVITY_INTERVAL_MS =
  Number.parseInt(process.env.LOYALTY_ACTIVITY_INTERVAL_SECONDS ?? "60", 10) *
  1000;

/** Evita crédito em todas as mensagens: 1 crédito por janela por usuário/canal */
const lastAwardAt = new Map<string, number>();

function activityKey(channelSlug: string, kickUserId: number): string {
  return `${channelSlug}:${kickUserId}`;
}

export interface LoyaltyUser {
  kickUserId: number;
  username: string;
  slug: string;
}

export class LoyaltyService {
  async trackChatActivity(channelSlug: string, msg: ChatMessage): Promise<void> {
    const key = activityKey(channelSlug, msg.sender.id);
    const now = Date.now();
    const last = lastAwardAt.get(key) ?? 0;
    if (now - last < ACTIVITY_INTERVAL_MS) return;

    lastAwardAt.set(key, now);
    await this.addPoints(
      channelSlug,
      {
        kickUserId: msg.sender.id,
        username: msg.sender.username,
        slug: msg.sender.slug,
      },
      POINTS_PER_ACTIVITY,
      "activity",
      "Atividade no chat"
    );
  }

  async addPoints(
    channelSlug: string,
    user: LoyaltyUser,
    amount: number,
    type: string,
    reason?: string
  ): Promise<void> {
    if (amount === 0) return;

    await prisma.$transaction(async (tx) => {
      await tx.viewerPoints.upsert({
        where: {
          channelSlug_kickUserId: {
            channelSlug,
            kickUserId: BigInt(user.kickUserId),
          },
        },
        update: {
          username: user.username,
          slug: user.slug,
          balance: { increment: amount },
        },
        create: {
          channelSlug,
          kickUserId: BigInt(user.kickUserId),
          username: user.username,
          slug: user.slug,
          balance: amount,
        },
      });

      await tx.pointTransaction.create({
        data: {
          channelSlug,
          kickUserId: BigInt(user.kickUserId),
          amount,
          type,
          reason,
        },
      });
    });
  }

  async getBalance(channelSlug: string, kickUserId: number): Promise<number> {
    const row = await prisma.viewerPoints.findUnique({
      where: {
        channelSlug_kickUserId: { channelSlug, kickUserId: BigInt(kickUserId) },
      },
    });
    return row?.balance ?? 0;
  }

  async getTop(channelSlug: string, limit = 10) {
    return prisma.viewerPoints.findMany({
      where: { channelSlug },
      orderBy: [{ balance: "desc" }, { updatedAt: "asc" }],
      take: limit,
    });
  }

  async transferPoints(
    channelSlug: string,
    from: LoyaltyUser,
    toUsernameOrSlug: string,
    amount: number
  ): Promise<{ ok: true; fromBalance: number; toUsername: string } | { ok: false; error: string }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Quantidade inválida." };
    }

    const targetKey = toUsernameOrSlug.replace(/^@/, "").trim().toLowerCase();
    if (!targetKey) return { ok: false, error: "Usuário alvo inválido." };

    const sender = await prisma.viewerPoints.findUnique({
      where: {
        channelSlug_kickUserId: {
          channelSlug,
          kickUserId: BigInt(from.kickUserId),
        },
      },
    });

    if (!sender || sender.balance < amount) {
      return { ok: false, error: "Saldo insuficiente para transferir." };
    }

    const receiver = await prisma.viewerPoints.findFirst({
      where: {
        channelSlug,
        OR: [
          { username: { equals: targetKey, mode: "insensitive" } },
          { slug: { equals: targetKey, mode: "insensitive" } },
        ],
      },
    });

    if (!receiver) {
      return { ok: false, error: "Usuário não encontrado no sistema de pontos." };
    }

    if (receiver.kickUserId === BigInt(from.kickUserId)) {
      return { ok: false, error: "Você não pode transferir para si mesmo." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.viewerPoints.update({
        where: { id: sender.id },
        data: { balance: { decrement: amount } },
      });
      await tx.viewerPoints.update({
        where: { id: receiver.id },
        data: { balance: { increment: amount } },
      });

      await tx.pointTransaction.createMany({
        data: [
          {
            channelSlug,
            kickUserId: sender.kickUserId,
            amount: -amount,
            type: "transfer_out",
            reason: `Transferência para ${receiver.username}`,
          },
          {
            channelSlug,
            kickUserId: receiver.kickUserId,
            amount,
            type: "transfer_in",
            reason: `Transferência de ${from.username}`,
          },
        ],
      });
    });

    return {
      ok: true,
      fromBalance: sender.balance - amount,
      toUsername: receiver.username,
    };
  }
}

export const loyaltyService = new LoyaltyService();
