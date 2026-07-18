import "dotenv/config";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import express from "express";
import type http from "node:http";
import { generateToken } from "../auth.js";
import { createLoyaltyRouter } from "./loyalty.js";
import { prisma } from "../../infra/prisma/client.js";
import {
  loyaltyService,
  __resetLoyaltyStateForTests,
} from "../../loyalty/loyaltyService.js";

const authHeader = {
  Authorization: `Bearer ${generateToken({ userId: "test-user", role: "admin" })}`,
};

async function withServer(fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api", createLoyaltyRouter());

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

describe("loyalty routes - config", () => {
  const originals = {
    getOrCreateConfig: loyaltyService.getOrCreateConfig.bind(loyaltyService),
    updateConfig: loyaltyService.updateConfig.bind(loyaltyService),
    awardForEvent: loyaltyService.awardForEvent.bind(loyaltyService),
    findUnique: prisma.loyaltyConfig.findUnique,
  };

  afterEach(() => {
    loyaltyService.getOrCreateConfig = originals.getOrCreateConfig;
    loyaltyService.updateConfig = originals.updateConfig;
    loyaltyService.awardForEvent = originals.awardForEvent;
    prisma.loyaltyConfig.findUnique = originals.findUnique;
    __resetLoyaltyStateForTests();
  });

  it("GET /api/loyalty/config retorna config", async () => {
    loyaltyService.getOrCreateConfig = (async () => ({
      channelSlug: "canal",
      chatEnabled: true,
      pointsPerChatActivity: 1,
      chatIntervalSeconds: 60,
      memberMultiplier: 1,
      memberBonusFlat: 0,
      eventFollowEnabled: false,
      eventFollowPoints: 0,
      eventSubscriptionEnabled: false,
      eventSubscriptionPoints: 0,
      eventGiftSubEnabled: false,
      eventGiftSubPoints: 0,
      eventRaidEnabled: false,
      eventRaidPoints: 0,
    })) as typeof loyaltyService.getOrCreateConfig;

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/loyalty/config?channel=canal`, {
        headers: authHeader,
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        success: boolean;
        data: { chatIntervalSeconds: number };
      };
      assert.equal(body.success, true);
      assert.equal(body.data.chatIntervalSeconds, 60);
    });
  });

  it("PUT /api/loyalty/config rejeita intervalo inválido", async () => {
    loyaltyService.updateConfig = (async (_slug, update) => {
      if (update.chatIntervalSeconds !== undefined && update.chatIntervalSeconds < 10) {
        return { ok: false as const, error: "chatIntervalSeconds deve estar entre 10 e 3600" };
      }
      return {
        ok: true as const,
        data: {
          channelSlug: "canal",
          chatEnabled: true,
          pointsPerChatActivity: 1,
          chatIntervalSeconds: 60,
          memberMultiplier: 1,
          memberBonusFlat: 0,
          eventFollowEnabled: false,
          eventFollowPoints: 0,
          eventSubscriptionEnabled: false,
          eventSubscriptionPoints: 0,
          eventGiftSubEnabled: false,
          eventGiftSubPoints: 0,
          eventRaidEnabled: false,
          eventRaidPoints: 0,
        },
      };
    }) as typeof loyaltyService.updateConfig;

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/loyalty/config`, {
        method: "PUT",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ channelSlug: "canal", chatIntervalSeconds: 5 }),
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { success: boolean; error: string };
      assert.equal(body.success, false);
      assert.match(body.error, /chatIntervalSeconds/);
    });
  });

  it("POST /api/loyalty/test-event credita pontos", async () => {
    loyaltyService.awardForEvent = (async () => ({
      awarded: 10,
    })) as typeof loyaltyService.awardForEvent;

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/loyalty/test-event`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          channelSlug: "canal",
          eventType: "follow",
          username: "tester",
        }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        success: boolean;
        data: { awarded: number };
      };
      assert.equal(body.success, true);
      assert.equal(body.data.awarded, 10);
    });
  });
});
