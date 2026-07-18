/**
 * Serviço de loyalty points (Fase 3+).
 * Config por canal: chat, eventos e bônus de membros (assinantes).
 */

import { prisma } from "../infra/prisma/client.js";
import type { ChatMessage } from "../chat/types.js";
import {
  DEFAULT_LOYALTY_CONFIG,
  type LoyaltyConfigData,
  type LoyaltyEventType,
  type LoyaltyConfigUpdate,
  validateLoyaltyConfigUpdate,
  getEventRule,
  applyMemberBonus,
} from "./loyaltyConfig.js";

export type { LoyaltyConfigData, LoyaltyEventType, LoyaltyConfigUpdate };
export { applyMemberBonus, validateLoyaltyConfigUpdate } from "./loyaltyConfig.js";

/** Evita crédito em todas as mensagens: 1 crédito por janela por usuário/canal */
const lastAwardAt = new Map<string, number>();

const configCache = new Map<
  string,
  { data: LoyaltyConfigData; loadedAt: number }
>();
const CONFIG_TTL_MS = 60_000;

function activityKey(channelSlug: string, kickUserId: number): string {
  return `${channelSlug}:${kickUserId}`;
}

function hasSubscriberBadge(
  badges: Array<{ type: string; text?: string }> | undefined
): boolean {
  if (!badges?.length) return false;
  return badges.some((b) => {
    const t = b.type.toLowerCase();
    return t === "subscriber" || t === "broadcaster";
  });
}

function toConfigData(row: {
  channelSlug: string;
  chatEnabled: boolean;
  pointsPerChatActivity: number;
  chatIntervalSeconds: number;
  memberMultiplier: number;
  memberBonusFlat: number;
  eventFollowEnabled: boolean;
  eventFollowPoints: number;
  eventSubscriptionEnabled: boolean;
  eventSubscriptionPoints: number;
  eventGiftSubEnabled: boolean;
  eventGiftSubPoints: number;
  eventRaidEnabled: boolean;
  eventRaidPoints: number;
}): LoyaltyConfigData {
  return {
    channelSlug: row.channelSlug,
    chatEnabled: row.chatEnabled,
    pointsPerChatActivity: row.pointsPerChatActivity,
    chatIntervalSeconds: row.chatIntervalSeconds,
    memberMultiplier: row.memberMultiplier,
    memberBonusFlat: row.memberBonusFlat,
    eventFollowEnabled: row.eventFollowEnabled,
    eventFollowPoints: row.eventFollowPoints,
    eventSubscriptionEnabled: row.eventSubscriptionEnabled,
    eventSubscriptionPoints: row.eventSubscriptionPoints,
    eventGiftSubEnabled: row.eventGiftSubEnabled,
    eventGiftSubPoints: row.eventGiftSubPoints,
    eventRaidEnabled: row.eventRaidEnabled,
    eventRaidPoints: row.eventRaidPoints,
  };
}

export function invalidateLoyaltyCache(channelSlug: string): void {
  configCache.delete(channelSlug);
}

export function __resetLoyaltyStateForTests(): void {
  configCache.clear();
  lastAwardAt.clear();
}

export interface LoyaltyUser {
  kickUserId: number;
  username: string;
  slug: string;
}

export class LoyaltyService {
  async getOrCreateConfig(channelSlug: string): Promise<LoyaltyConfigData> {
    const cached = configCache.get(channelSlug);
    if (cached && Date.now() - cached.loadedAt < CONFIG_TTL_MS) {
      return cached.data;
    }

    let row = await prisma.loyaltyConfig.findUnique({ where: { channelSlug } });
    if (!row) {
      row = await prisma.loyaltyConfig.create({
        data: {
          channelSlug,
          ...DEFAULT_LOYALTY_CONFIG,
        },
      });
    }

    const data = toConfigData(row);
    configCache.set(channelSlug, { data, loadedAt: Date.now() });
    return data;
  }

  async updateConfig(
    channelSlug: string,
    update: LoyaltyConfigUpdate
  ): Promise<{ ok: true; data: LoyaltyConfigData } | { ok: false; error: string }> {
    const validation = validateLoyaltyConfigUpdate(update);
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }

    const current = await this.getOrCreateConfig(channelSlug);
    const merged = { ...current, ...update, channelSlug };

    const row = await prisma.loyaltyConfig.upsert({
      where: { channelSlug },
      create: {
        channelSlug,
        chatEnabled: merged.chatEnabled,
        pointsPerChatActivity: merged.pointsPerChatActivity,
        chatIntervalSeconds: merged.chatIntervalSeconds,
        memberMultiplier: merged.memberMultiplier,
        memberBonusFlat: merged.memberBonusFlat,
        eventFollowEnabled: merged.eventFollowEnabled,
        eventFollowPoints: merged.eventFollowPoints,
        eventSubscriptionEnabled: merged.eventSubscriptionEnabled,
        eventSubscriptionPoints: merged.eventSubscriptionPoints,
        eventGiftSubEnabled: merged.eventGiftSubEnabled,
        eventGiftSubPoints: merged.eventGiftSubPoints,
        eventRaidEnabled: merged.eventRaidEnabled,
        eventRaidPoints: merged.eventRaidPoints,
      },
      update: {
        ...(update.chatEnabled !== undefined && { chatEnabled: update.chatEnabled }),
        ...(update.pointsPerChatActivity !== undefined && {
          pointsPerChatActivity: update.pointsPerChatActivity,
        }),
        ...(update.chatIntervalSeconds !== undefined && {
          chatIntervalSeconds: update.chatIntervalSeconds,
        }),
        ...(update.memberMultiplier !== undefined && {
          memberMultiplier: update.memberMultiplier,
        }),
        ...(update.memberBonusFlat !== undefined && {
          memberBonusFlat: update.memberBonusFlat,
        }),
        ...(update.eventFollowEnabled !== undefined && {
          eventFollowEnabled: update.eventFollowEnabled,
        }),
        ...(update.eventFollowPoints !== undefined && {
          eventFollowPoints: update.eventFollowPoints,
        }),
        ...(update.eventSubscriptionEnabled !== undefined && {
          eventSubscriptionEnabled: update.eventSubscriptionEnabled,
        }),
        ...(update.eventSubscriptionPoints !== undefined && {
          eventSubscriptionPoints: update.eventSubscriptionPoints,
        }),
        ...(update.eventGiftSubEnabled !== undefined && {
          eventGiftSubEnabled: update.eventGiftSubEnabled,
        }),
        ...(update.eventGiftSubPoints !== undefined && {
          eventGiftSubPoints: update.eventGiftSubPoints,
        }),
        ...(update.eventRaidEnabled !== undefined && {
          eventRaidEnabled: update.eventRaidEnabled,
        }),
        ...(update.eventRaidPoints !== undefined && {
          eventRaidPoints: update.eventRaidPoints,
        }),
      },
    });

    invalidateLoyaltyCache(channelSlug);
    const data = toConfigData(row);
    configCache.set(channelSlug, { data, loadedAt: Date.now() });
    return { ok: true, data };
  }

  async trackChatActivity(channelSlug: string, msg: ChatMessage): Promise<void> {
    const config = await this.getOrCreateConfig(channelSlug);
    if (!config.chatEnabled || config.pointsPerChatActivity <= 0) return;

    const key = activityKey(channelSlug, msg.sender.id);
    const now = Date.now();
    const last = lastAwardAt.get(key) ?? 0;
    const intervalMs = config.chatIntervalSeconds * 1000;
    if (now - last < intervalMs) return;

    lastAwardAt.set(key, now);

    const isMember = hasSubscriberBadge(msg.sender.identity?.badges);
    const amount = applyMemberBonus(
      config.pointsPerChatActivity,
      isMember,
      config
    );
    if (amount <= 0) return;

    await this.addPoints(
      channelSlug,
      {
        kickUserId: msg.sender.id,
        username: msg.sender.username,
        slug: msg.sender.slug,
      },
      amount,
      "activity",
      isMember ? "Atividade no chat (membro)" : "Atividade no chat"
    );
  }

  async awardForEvent(
    channelSlug: string,
    user: LoyaltyUser,
    eventType: LoyaltyEventType,
    options?: { isMember?: boolean }
  ): Promise<{ awarded: number }> {
    const config = await this.getOrCreateConfig(channelSlug);
    const rule = getEventRule(config, eventType);
    if (!rule.enabled || rule.points <= 0) {
      return { awarded: 0 };
    }

    const treatAsMember =
      eventType === "subscription" ||
      eventType === "gift_sub" ||
      options?.isMember === true;

    const amount = applyMemberBonus(rule.points, treatAsMember, config);
    if (amount <= 0) return { awarded: 0 };

    const labels: Record<LoyaltyEventType, string> = {
      follow: "Follow",
      subscription: "Assinatura",
      gift_sub: "Gift sub",
      raid: "Raid",
    };

    await this.addPoints(
      channelSlug,
      user,
      amount,
      `event_${eventType}`,
      `Evento: ${labels[eventType]}`
    );

    return { awarded: amount };
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
