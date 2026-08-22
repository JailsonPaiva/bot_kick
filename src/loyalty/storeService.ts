/**
 * Loja de pontos por canal: itens e resgates.
 */

import { prisma } from "../infra/prisma/client.js";

export interface StoreUser {
  kickUserId: number;
  username: string;
  slug: string;
}

export interface StoreItemInput {
  code: string;
  title: string;
  description?: string;
  costPoints: number;
  stock?: number | null;
  cooldownSeconds?: number;
  isActive?: boolean;
}

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function clampNonNegativeInt(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return fallback;
  return n;
}

function normalizeStock(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return clampNonNegativeInt(value, 0);
}

export class StoreService {
  async listItems(channelSlug: string, includeInactive = false) {
    return prisma.storeItem.findMany({
      where: {
        channelSlug,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });
  }

  async createItem(channelSlug: string, payload: StoreItemInput) {
    const code = normalizeCode(payload.code);
    const title = String(payload.title ?? "").trim();
    const costPoints = clampNonNegativeInt(payload.costPoints, 0);
    if (!code) throw new Error("code é obrigatório (apenas letras, números, _ e -).");
    if (!title) throw new Error("title é obrigatório.");
    if (costPoints <= 0) throw new Error("costPoints deve ser maior que zero.");

    try {
      return await prisma.storeItem.create({
        data: {
          channelSlug,
          code,
          title,
          description: payload.description?.trim() || null,
          costPoints,
          stock: normalizeStock(payload.stock),
          cooldownSeconds: clampNonNegativeInt(payload.cooldownSeconds, 0),
          isActive: payload.isActive ?? true,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unique constraint")) {
        throw new Error("Já existe item com este código neste canal.");
      }
      throw error;
    }
  }

  async updateItem(channelSlug: string, itemId: string, payload: Partial<StoreItemInput>) {
    const current = await prisma.storeItem.findFirst({
      where: { id: itemId, channelSlug },
    });
    if (!current) throw new Error("Item não encontrado.");

    const updateData: Record<string, unknown> = {};
    if (payload.code !== undefined) {
      const code = normalizeCode(payload.code);
      if (!code) throw new Error("code inválido.");
      updateData.code = code;
    }
    if (payload.title !== undefined) {
      const title = String(payload.title ?? "").trim();
      if (!title) throw new Error("title inválido.");
      updateData.title = title;
    }
    if (payload.description !== undefined) {
      updateData.description = payload.description?.trim() || null;
    }
    if (payload.costPoints !== undefined) {
      const cost = clampNonNegativeInt(payload.costPoints, 0);
      if (cost <= 0) throw new Error("costPoints deve ser maior que zero.");
      updateData.costPoints = cost;
    }
    if (payload.stock !== undefined) {
      updateData.stock = normalizeStock(payload.stock);
    }
    if (payload.cooldownSeconds !== undefined) {
      updateData.cooldownSeconds = clampNonNegativeInt(payload.cooldownSeconds, 0);
    }
    if (payload.isActive !== undefined) {
      updateData.isActive = Boolean(payload.isActive);
    }

    try {
      return await prisma.storeItem.update({
        where: { id: current.id },
        data: updateData,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unique constraint")) {
        throw new Error("Já existe item com este código neste canal.");
      }
      throw error;
    }
  }

  async deactivateItem(channelSlug: string, itemId: string) {
    const current = await prisma.storeItem.findFirst({
      where: { id: itemId, channelSlug },
      select: { id: true },
    });
    if (!current) throw new Error("Item não encontrado.");
    return prisma.storeItem.update({
      where: { id: current.id },
      data: { isActive: false },
    });
  }

  async listRedemptions(channelSlug: string, page = 1, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const currentPage = Math.max(page, 1);
    const [rows, total] = await Promise.all([
      prisma.storeRedemption.findMany({
        where: { channelSlug },
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * take,
        take,
      }),
      prisma.storeRedemption.count({ where: { channelSlug } }),
    ]);
    return {
      redemptions: rows,
      total,
      page: currentPage,
      totalPages: Math.ceil(total / take),
    };
  }

  async redeemByCode(
    channelSlug: string,
    user: StoreUser,
    codeRaw: string,
    quantityRaw?: number
  ): Promise<
    | {
        ok: true;
        itemTitle: string;
        quantity: number;
        totalCost: number;
        remainingBalance: number;
      }
    | { ok: false; error: string }
  > {
    const code = normalizeCode(codeRaw);
    const quantity = Math.max(1, clampNonNegativeInt(quantityRaw, 1));
    if (!code) return { ok: false, error: "Informe o código de um item válido para resgate." };

    const item = await prisma.storeItem.findFirst({
      where: { channelSlug, code, isActive: true },
    });
    if (!item) return { ok: false, error: "Item não encontrado ou inativo." };

    if (item.stock !== null && item.stock < quantity) {
      return { ok: false, error: "Estoque insuficiente para este resgate." };
    }

    if (item.cooldownSeconds > 0) {
      const latest = await prisma.storeRedemption.findFirst({
        where: {
          channelSlug,
          itemId: item.id,
          kickUserId: BigInt(user.kickUserId),
        },
        orderBy: { createdAt: "desc" },
      });
      if (latest) {
        const elapsedMs = Date.now() - latest.createdAt.getTime();
        const remaining = Math.ceil(item.cooldownSeconds - elapsedMs / 1000);
        if (remaining > 0) {
          return {
            ok: false,
            error: `Aguarde ${remaining}s para resgatar este item novamente.`,
          };
        }
      }
    }

    const totalCost = item.costPoints * quantity;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const viewer = await tx.viewerPoints.findUnique({
          where: {
            channelSlug_kickUserId: {
              channelSlug,
              kickUserId: BigInt(user.kickUserId),
            },
          },
        });
        const balance = viewer?.balance ?? 0;
        if (balance < totalCost) {
          throw new Error("Saldo insuficiente para este resgate.");
        }

        if (item.stock !== null) {
          const current = await tx.storeItem.findUnique({ where: { id: item.id } });
          if (!current || current.stock === null || current.stock < quantity) {
            throw new Error("Estoque insuficiente para este resgate.");
          }
          await tx.storeItem.update({
            where: { id: item.id },
            data: { stock: { decrement: quantity } },
          });
        }

        await tx.viewerPoints.update({
          where: { id: viewer!.id },
          data: { balance: { decrement: totalCost } },
        });
        await tx.pointTransaction.create({
          data: {
            channelSlug,
            kickUserId: BigInt(user.kickUserId),
            amount: -totalCost,
            type: "store_redeem",
            reason: `Resgate na loja: ${item.code} x${quantity}`,
          },
        });
        await tx.storeRedemption.create({
          data: {
            channelSlug,
            itemId: item.id,
            itemCode: item.code,
            itemTitle: item.title,
            kickUserId: BigInt(user.kickUserId),
            username: user.username,
            slug: user.slug,
            quantity,
            totalCost,
          },
        });

        return balance - totalCost;
      });

      return {
        ok: true,
        itemTitle: item.title,
        quantity,
        totalCost,
        remainingBalance: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  }
}

export const storeService = new StoreService();
