import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import express from "express";
import type http from "node:http";
import { createPublicRouter } from "./public.js";
import { storeService } from "../../loyalty/storeService.js";
import { loyaltyService } from "../../loyalty/loyaltyService.js";
import { prisma } from "../../infra/prisma/client.js";
import { generateStoreViewerToken } from "../storeViewerAuth.js";

async function withServer(fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api", createPublicRouter());

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

const originalListItems = storeService.listItems;
const originalRedeemByCode = storeService.redeemByCode;
const originalGetBalance = loyaltyService.getBalance;
const originalRedemptionsFindMany = prisma.storeRedemption.findMany;

afterEach(() => {
  storeService.listItems = originalListItems;
  storeService.redeemByCode = originalRedeemByCode;
  loyaltyService.getBalance = originalGetBalance;
  prisma.storeRedemption.findMany = originalRedemptionsFindMany;
});

describe("public store routes", () => {
  it("lista itens públicos ativos", async () => {
    storeService.listItems = (async () =>
      [
        {
          id: "item-1",
          code: "vip",
          title: "VIP 5 min",
          description: null,
          costPoints: 100,
          stock: null,
          cooldownSeconds: 30,
        },
      ]) as typeof storeService.listItems;

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/public/store/canal/items`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; data: Array<{ code: string }> };
      assert.equal(json.success, true);
      assert.equal(json.data[0]?.code, "vip");
    });
  });

  it("bloqueia consulta /me sem viewerToken", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/public/store/canal/me`);
      assert.equal(res.status, 401);
    });
  });

  it("retorna saldo do viewer autenticado", async () => {
    loyaltyService.getBalance = (async () => 250) as typeof loyaltyService.getBalance;
    prisma.storeRedemption.findMany = (async () => []) as typeof prisma.storeRedemption.findMany;
    const token = generateStoreViewerToken({
      channelSlug: "canal",
      kickUserId: 777,
      username: "viewer",
      slug: "viewer",
    });

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/public/store/canal/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; data: { balance: number } };
      assert.equal(json.success, true);
      assert.equal(json.data.balance, 250);
    });
  });

  it("processa resgate autenticado", async () => {
    storeService.redeemByCode = (async () =>
      ({
        ok: true,
        itemTitle: "VIP 5 min",
        quantity: 1,
        totalCost: 100,
        remainingBalance: 50,
      }) as const) as typeof storeService.redeemByCode;
    const token = generateStoreViewerToken({
      channelSlug: "canal",
      kickUserId: 777,
      username: "viewer",
      slug: "viewer",
    });

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/public/store/canal/redeem`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: "vip", quantity: 1 }),
      });
      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; data: { ok: boolean } };
      assert.equal(json.success, true);
      assert.equal(json.data.ok, true);
    });
  });
});
