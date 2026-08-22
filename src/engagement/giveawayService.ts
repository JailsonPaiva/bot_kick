/**
 * Serviço de sorteios (Fase 4).
 */

import { randomInt } from "node:crypto";
import { prisma } from "../infra/prisma/client.js";

export type GiveawayEntryMode = "command" | "chat";

export interface GiveawayUser {
  kickUserId: number;
  username: string;
  slug: string;
  badges: Array<{ type: string; text: string }>;
}

export interface CreateGiveawayOptions {
  prize: string;
  filterType?: string;
  costPoints?: number;
  weightedSubs?: boolean;
  entryMode?: GiveawayEntryMode;
  entryCommand?: string;
  entryDurationSeconds?: number;
}

export interface GiveawayDrawWidgetOptions {
  animationDurationMs: number;
  confettiEnabled: boolean;
  soundEnabled: boolean;
  showTopParticipants: boolean;
  topParticipantsLimit: number;
}

const MIN_CHAT_ENTRY_SECONDS = 15;
const MAX_CHAT_ENTRY_SECONDS = 3600;
const DEFAULT_CHAT_ENTRY_SECONDS = 60;
const DEFAULT_WIDGET_ANIMATION_MS = 3600;
const MIN_WIDGET_ANIMATION_MS = 1200;
const MAX_WIDGET_ANIMATION_MS = 12000;
const DEFAULT_TOP_PARTICIPANTS_LIMIT = 5;
const MIN_TOP_PARTICIPANTS_LIMIT = 3;
const MAX_TOP_PARTICIPANTS_LIMIT = 10;

function normalizeFilter(filterType: string): string {
  const value = filterType.toLowerCase();
  if (value === "subscribers" || value === "followers" || value === "both") return value;
  return "everyone";
}

export function normalizeEntryMode(value: unknown): GiveawayEntryMode {
  return value === "chat" ? "chat" : "command";
}

export function normalizeEntryCommand(value: unknown): string {
  const raw = String(value ?? "entrar")
    .trim()
    .toLowerCase()
    .replace(/^!+/, "")
    .replace(/[^a-z0-9_-]/g, "");
  return raw || "entrar";
}

export function clampEntryDurationSeconds(value: unknown): number {
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return DEFAULT_CHAT_ENTRY_SECONDS;
  }
  return Math.min(MAX_CHAT_ENTRY_SECONDS, Math.max(MIN_CHAT_ENTRY_SECONDS, n));
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeGiveawayDrawWidgetOptions(
  value: unknown
): GiveawayDrawWidgetOptions {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    animationDurationMs: clampInt(
      source.animationDurationMs,
      MIN_WIDGET_ANIMATION_MS,
      MAX_WIDGET_ANIMATION_MS,
      DEFAULT_WIDGET_ANIMATION_MS
    ),
    confettiEnabled: parseBoolean(source.confettiEnabled, true),
    soundEnabled: parseBoolean(source.soundEnabled, false),
    showTopParticipants: parseBoolean(source.showTopParticipants, true),
    topParticipantsLimit: clampInt(
      source.topParticipantsLimit,
      MIN_TOP_PARTICIPANTS_LIMIT,
      MAX_TOP_PARTICIPANTS_LIMIT,
      DEFAULT_TOP_PARTICIPANTS_LIMIT
    ),
  };
}

export const defaultGiveawayDrawWidgetOptions: GiveawayDrawWidgetOptions =
  normalizeGiveawayDrawWidgetOptions(undefined);

export function hasSubscriberBadge(badges: GiveawayUser["badges"]): boolean {
  return badges.some((b) => {
    const t = b.type.toLowerCase();
    return t === "subscriber" || t === "broadcaster";
  });
}

export function hasFollowerBadge(badges: GiveawayUser["badges"]): boolean {
  return badges.some((b) => {
    const t = b.type.toLowerCase();
    return t === "follower" || t === "following" || t === "og";
  });
}

export function canEnter(
  filterType: string,
  badges: GiveawayUser["badges"],
  knownFollower = false
): boolean {
  const isSub = hasSubscriberBadge(badges);
  const isFollower = knownFollower || hasFollowerBadge(badges);
  if (filterType === "everyone") return true;
  if (filterType === "subscribers") return isSub;
  if (filterType === "followers") return isFollower;
  if (filterType === "both") return isSub || isFollower;
  return true;
}

export function resolveEntryWeight(
  weightedSubs: boolean,
  badges: GiveawayUser["badges"]
): number {
  return weightedSubs && hasSubscriberBadge(badges) ? 2 : 1;
}

export function isEntryWindowOpen(giveaway: {
  entryMode: string;
  entryEndsAt: Date | null;
}, now = new Date()): boolean {
  if (normalizeEntryMode(giveaway.entryMode) !== "chat") return true;
  if (!giveaway.entryEndsAt) return false;
  return giveaway.entryEndsAt.getTime() > now.getTime();
}

/** Sorteio ponderado: weight 2 = duas chances */
export function pickWeightedEntry<T extends { weight: number }>(
  entries: readonly T[]
): T | null {
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((sum, e) => sum + Math.max(1, e.weight), 0);
  let ticket = randomInt(totalWeight);
  for (const entry of entries) {
    const w = Math.max(1, entry.weight);
    if (ticket < w) return entry;
    ticket -= w;
  }
  return entries[entries.length - 1] ?? null;
}

export function totalEntryTickets(
  entries: ReadonlyArray<{ weight: number }>
): number {
  return entries.reduce((sum, e) => sum + Math.max(1, e.weight), 0);
}

export async function isKnownFollower(
  channelSlug: string,
  kickUserId: number
): Promise<boolean> {
  const row = await prisma.pointTransaction.findFirst({
    where: {
      channelSlug,
      kickUserId: BigInt(kickUserId),
      type: "follow",
    },
    select: { id: true },
  });
  return Boolean(row);
}

export function describeEntryInstructions(giveaway: {
  entryMode: string;
  entryCommand: string;
  entryEndsAt: Date | null;
  costPoints: number;
  weightedSubs: boolean;
}): string {
  const cost =
    giveaway.costPoints > 0 ? ` (custo ${giveaway.costPoints} ponto(s))` : "";
  const subs = giveaway.weightedSubs ? " · Assinantes têm 2x entradas" : "";
  if (normalizeEntryMode(giveaway.entryMode) === "chat") {
    const ends = giveaway.entryEndsAt
      ? ` até ${giveaway.entryEndsAt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`
      : "";
    return `Digite qualquer mensagem no chat${ends} para participar${cost}${subs}`;
  }
  return `Para participar use !${normalizeEntryCommand(giveaway.entryCommand)}${cost}${subs}`;
}

export class GiveawayService {
  async create(channelSlug: string, options: CreateGiveawayOptions) {
    const existing = await this.getOpen(channelSlug);
    if (existing) {
      throw new Error("Já existe um sorteio aberto neste canal.");
    }

    const prize = options.prize.trim();
    if (!prize) {
      throw new Error("Prêmio inválido para sorteio.");
    }

    const entryMode = normalizeEntryMode(options.entryMode);
    const entryCommand = normalizeEntryCommand(options.entryCommand);
    const entryDurationSeconds = clampEntryDurationSeconds(
      options.entryDurationSeconds
    );
    const entryEndsAt =
      entryMode === "chat"
        ? new Date(Date.now() + entryDurationSeconds * 1000)
        : null;

    return prisma.giveaway.create({
      data: {
        channelSlug,
        prize,
        filterType: normalizeFilter(options.filterType ?? "everyone"),
        costPoints: Math.max(0, Math.floor(options.costPoints ?? 0)),
        weightedSubs: Boolean(options.weightedSubs),
        entryMode,
        entryCommand,
        entryDurationSeconds,
        entryEndsAt,
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

  async enterOpen(
    channelSlug: string,
    user: GiveawayUser,
    source: "command" | "chat" = "command"
  ): Promise<
    | { ok: true; participants: number; entryWeight: number; tickets: number }
    | { ok: false; error: string; silent?: boolean }
  > {
    const giveaway = await this.getOpen(channelSlug);
    if (!giveaway) {
      return { ok: false, error: "Nenhum sorteio aberto no momento.", silent: source === "chat" };
    }

    const mode = normalizeEntryMode(giveaway.entryMode);

    if (source === "command" && mode === "chat") {
      return {
        ok: false,
        error: "Este sorteio aceita entrada apenas digitando no chat durante o período.",
      };
    }

    if (source === "chat" && mode !== "chat") {
      return { ok: false, error: "Entrada por chat desativada.", silent: true };
    }

    if (mode === "chat" && !isEntryWindowOpen(giveaway)) {
      return {
        ok: false,
        error: "O período de entrada deste sorteio já encerrou.",
        silent: source === "chat",
      };
    }

    const knownFollower = await isKnownFollower(channelSlug, user.kickUserId);
    if (!canEnter(giveaway.filterType, user.badges, knownFollower)) {
      return {
        ok: false,
        error: "Você não atende aos requisitos deste sorteio.",
        silent: source === "chat",
      };
    }

    const entryWeight = resolveEntryWeight(giveaway.weightedSubs, user.badges);

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
            weight: entryWeight,
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unique constraint")) {
        return {
          ok: false,
          error: "Você já está participando deste sorteio.",
          silent: source === "chat",
        };
      }
      return { ok: false, error: message, silent: source === "chat" };
    }

    const entries = await prisma.giveawayEntry.findMany({
      where: { giveawayId: giveaway.id },
      select: { weight: true },
    });

    return {
      ok: true,
      participants: entries.length,
      entryWeight,
      tickets: totalEntryTickets(entries),
    };
  }

  /** Entrada silenciosa por mensagem no chat (modo período). */
  async tryEnterFromChat(
    channelSlug: string,
    user: GiveawayUser
  ): Promise<{ entered: boolean; entryWeight?: number }> {
    const result = await this.enterOpen(channelSlug, user, "chat");
    if (!result.ok) return { entered: false };
    return { entered: true, entryWeight: result.entryWeight };
  }

  async draw(channelSlug: string): Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        winner: { kickUserId: number; username: string } | null;
        giveawayId: string;
        entries: number;
        tickets: number;
        participants: Array<{ username: string; weight: number }>;
        prize: string;
      }
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
        tickets: 0,
        participants: [],
        prize: giveaway.prize,
      };
    }

    const winner = pickWeightedEntry(entries)!;
    const tickets = totalEntryTickets(entries);

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
      winner: {
        kickUserId: Number(winner.kickUserId),
        username: winner.username,
      },
      giveawayId: giveaway.id,
      entries: entries.length,
      tickets,
      participants: entries.map((entry) => ({
        username: entry.username,
        weight: Math.max(1, entry.weight),
      })),
      prize: giveaway.prize,
    };
  }

  async reroll(channelSlug: string): Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        winner: { kickUserId: number; username: string };
        giveawayId: string;
        entries: number;
        tickets: number;
        participants: Array<{ username: string; weight: number }>;
        prize: string;
      }
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

    const winner = pickWeightedEntry(entries)!;

    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { winnerKickUserId: winner.kickUserId },
    });

    return {
      ok: true,
      winner: {
        kickUserId: Number(winner.kickUserId),
        username: winner.username,
      },
      giveawayId: giveaway.id,
      entries: entries.length,
      tickets: totalEntryTickets(entries),
      participants: entries.map((entry) => ({
        username: entry.username,
        weight: Math.max(1, entry.weight),
      })),
      prize: giveaway.prize,
    };
  }
}

export const giveawayService = new GiveawayService();
