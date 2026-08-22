import "dotenv/config";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { prisma } from "../infra/prisma/client.js";
import { storeService } from "./storeService.js";

const originals = {
  listItems: prisma.storeItem.findMany,
  createItem: prisma.storeItem.create,
  findFirstItem: prisma.storeItem.findFirst,
  updateItem: prisma.storeItem.update,
  findUniqueItem: prisma.storeItem.findUnique,
  findRedemption: prisma.storeRedemption.findFirst,
  tx: prisma.$transaction,
};

afterEach(() => {
  prisma.storeItem.findMany = originals.listItems;
  prisma.storeItem.create = originals.createItem;
  prisma.storeItem.findFirst = originals.findFirstItem;
  prisma.storeItem.update = originals.updateItem;
  prisma.storeItem.findUnique = originals.findUniqueItem;
  prisma.storeRedemption.findFirst = originals.findRedemption;
  prisma.$transaction = originals.tx;
});

describe("storeService", () => {
  it("createItem normaliza código e valida custo", async () => {
    prisma.storeItem.create = (async ({ data }: { data: Record<string, unknown> }) => ({
      id: "item1",
      ...data,
    })) as typeof prisma.storeItem.create;

    const item = await storeService.createItem("canal", {
      code: " Vip+ ",
      title: "VIP",
      costPoints: 250,
    });

    assert.equal(item.code, "vip");
    await assert.rejects(
      () =>
        storeService.createItem("canal", {
          code: "x",
          title: "x",
          costPoints: 0,
        }),
      /costPoints/
    );
  });

  it("redeemByCode retorna erro com saldo insuficiente", async () => {
    prisma.storeItem.findFirst = (async () => ({
      id: "item2",
      channelSlug: "canal",
      code: "vip",
      title: "VIP",
      costPoints: 500,
      stock: null,
      cooldownSeconds: 0,
      isActive: true,
    })) as typeof prisma.storeItem.findFirst;
    prisma.storeRedemption.findFirst = (async () => null) as typeof prisma.storeRedemption.findFirst;

    prisma.$transaction = (async (callback: (tx: any) => Promise<number>) => {
      const tx = {
        viewerPoints: {
          findUnique: async () => ({ id: "vp1", balance: 100 }),
          update: async () => ({}),
        },
        storeItem: {
          findUnique: async () => null,
          update: async () => ({}),
        },
        pointTransaction: {
          create: async () => ({}),
        },
        storeRedemption: {
          create: async () => ({}),
        },
      };
      return callback(tx);
    }) as typeof prisma.$transaction;

    const result = await storeService.redeemByCode(
      "canal",
      { kickUserId: 10, username: "viewer", slug: "viewer" },
      "vip"
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Saldo insuficiente/i);
    }
  });

  it("redeemByCode registra resgate quando saldo suficiente", async () => {
    prisma.storeItem.findFirst = (async () => ({
      id: "item3",
      channelSlug: "canal",
      code: "som",
      title: "Tocar som",
      costPoints: 100,
      stock: 10,
      cooldownSeconds: 0,
      isActive: true,
    })) as typeof prisma.storeItem.findFirst;
    prisma.storeRedemption.findFirst = (async () => null) as typeof prisma.storeRedemption.findFirst;

    prisma.$transaction = (async (callback: (tx: any) => Promise<number>) => {
      const tx = {
        viewerPoints: {
          findUnique: async () => ({ id: "vp2", balance: 500 }),
          update: async () => ({}),
        },
        storeItem: {
          findUnique: async () => ({ id: "item3", stock: 10 }),
          update: async () => ({}),
        },
        pointTransaction: {
          create: async () => ({}),
        },
        storeRedemption: {
          create: async () => ({}),
        },
      };
      return callback(tx);
    }) as typeof prisma.$transaction;

    const result = await storeService.redeemByCode(
      "canal",
      { kickUserId: 11, username: "viewer2", slug: "viewer2" },
      "som",
      2
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.totalCost, 200);
      assert.equal(result.remainingBalance, 300);
    }
  });
});
