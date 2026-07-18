import "dotenv/config";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  applyMemberBonus,
  validateLoyaltyConfigUpdate,
  getEventRule,
  type LoyaltyConfigData,
} from "./loyaltyConfig.js";
import {
  LoyaltyService,
  __resetLoyaltyStateForTests,
} from "./loyaltyService.js";
import { prisma } from "../infra/prisma/client.js";
import type { ChatMessage } from "../chat/types.js";

const baseConfig: LoyaltyConfigData = {
  channelSlug: "canal-teste",
  chatEnabled: true,
  pointsPerChatActivity: 1,
  chatIntervalSeconds: 60,
  memberMultiplier: 2,
  memberBonusFlat: 1,
  eventFollowEnabled: true,
  eventFollowPoints: 10,
  eventSubscriptionEnabled: true,
  eventSubscriptionPoints: 50,
  eventGiftSubEnabled: false,
  eventGiftSubPoints: 0,
  eventRaidEnabled: true,
  eventRaidPoints: 20,
};

function makeMsg(
  id: number,
  badges: Array<{ type: string; text: string }> = []
): ChatMessage {
  return {
    id: `msg-${id}`,
    content: "oi",
    chatroom_id: 1,
    created_at: new Date().toISOString(),
    sender: {
      id,
      username: `user${id}`,
      slug: `user${id}`,
      identity: { color: "#fff", badges },
    },
  };
}

describe("applyMemberBonus", () => {
  it("retorna base para não-membro", () => {
    assert.equal(applyMemberBonus(5, false, baseConfig), 5);
  });

  it("aplica floor(base * mult) + flat para membro", () => {
    assert.equal(applyMemberBonus(1, true, baseConfig), 3); // floor(1*2)+1
    assert.equal(applyMemberBonus(3, true, { memberMultiplier: 1.5, memberBonusFlat: 2 }), 6);
  });

  it("retorna 0 para base inválida", () => {
    assert.equal(applyMemberBonus(0, true, baseConfig), 0);
    assert.equal(applyMemberBonus(-1, true, baseConfig), 0);
  });
});

describe("validateLoyaltyConfigUpdate", () => {
  it("aceita update válido", () => {
    const result = validateLoyaltyConfigUpdate({
      chatIntervalSeconds: 30,
      memberMultiplier: 1.5,
      pointsPerChatActivity: 2,
    });
    assert.equal(result.ok, true);
  });

  it("rejeita intervalo < 10", () => {
    const result = validateLoyaltyConfigUpdate({ chatIntervalSeconds: 5 });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /chatIntervalSeconds/);
    }
  });

  it("rejeita multiplicador < 1", () => {
    const result = validateLoyaltyConfigUpdate({ memberMultiplier: 0.5 });
    assert.equal(result.ok, false);
  });
});

describe("getEventRule", () => {
  it("retorna regra do evento", () => {
    assert.deepEqual(getEventRule(baseConfig, "follow"), {
      enabled: true,
      points: 10,
    });
    assert.deepEqual(getEventRule(baseConfig, "gift_sub"), {
      enabled: false,
      points: 0,
    });
  });
});

describe("LoyaltyService", () => {
  const originals = {
    findUnique: prisma.loyaltyConfig.findUnique,
    create: prisma.loyaltyConfig.create,
    upsert: prisma.loyaltyConfig.upsert,
    transaction: prisma.$transaction,
  };

  afterEach(() => {
    prisma.loyaltyConfig.findUnique = originals.findUnique;
    prisma.loyaltyConfig.create = originals.create;
    prisma.loyaltyConfig.upsert = originals.upsert;
    prisma.$transaction = originals.transaction;
    __resetLoyaltyStateForTests();
  });

  it("trackChatActivity credita com bônus de membro e respeita intervalo", async () => {
    const service = new LoyaltyService();
    const awards: Array<{ amount: number; reason?: string }> = [];

    prisma.loyaltyConfig.findUnique = (async () => ({
      id: "1",
      ...baseConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as typeof prisma.loyaltyConfig.findUnique;

    prisma.$transaction = (async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        viewerPoints: {
          upsert: async () => ({}),
        },
        pointTransaction: {
          create: async (args: { data: { amount: number; reason?: string } }) => {
            awards.push({ amount: args.data.amount, reason: args.data.reason });
            return {};
          },
        },
      };
      return fn(tx);
    }) as typeof prisma.$transaction;

    await service.trackChatActivity(
      "canal-teste",
      makeMsg(10, [{ type: "subscriber", text: "Sub" }])
    );
    assert.equal(awards.length, 1);
    assert.equal(awards[0].amount, 3);

    await service.trackChatActivity(
      "canal-teste",
      makeMsg(10, [{ type: "subscriber", text: "Sub" }])
    );
    assert.equal(awards.length, 1, "segundo crédito dentro do intervalo deve ser ignorado");
  });

  it("awardForEvent não credita quando evento desabilitado", async () => {
    const service = new LoyaltyService();
    let addCalled = false;

    prisma.loyaltyConfig.findUnique = (async () => ({
      id: "1",
      ...baseConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as typeof prisma.loyaltyConfig.findUnique;

    prisma.$transaction = (async () => {
      addCalled = true;
    }) as typeof prisma.$transaction;

    const result = await service.awardForEvent(
      "canal-teste",
      { kickUserId: 1, username: "u", slug: "u" },
      "gift_sub"
    );
    assert.equal(result.awarded, 0);
    assert.equal(addCalled, false);
  });

  it("awardForEvent aplica bônus de membro em subscription", async () => {
    const service = new LoyaltyService();
    const awards: number[] = [];

    prisma.loyaltyConfig.findUnique = (async () => ({
      id: "1",
      ...baseConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as typeof prisma.loyaltyConfig.findUnique;

    prisma.$transaction = (async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        viewerPoints: { upsert: async () => ({}) },
        pointTransaction: {
          create: async (args: { data: { amount: number } }) => {
            awards.push(args.data.amount);
            return {};
          },
        },
      };
      return fn(tx);
    }) as typeof prisma.$transaction;

    const result = await service.awardForEvent(
      "canal-teste",
      { kickUserId: 2, username: "sub", slug: "sub" },
      "subscription"
    );
    // floor(50 * 2) + 1 = 101
    assert.equal(result.awarded, 101);
    assert.equal(awards[0], 101);
  });

  it("updateConfig rejeita intervalo inválido", async () => {
    const service = new LoyaltyService();
    const result = await service.updateConfig("canal-teste", {
      chatIntervalSeconds: 5,
    });
    assert.equal(result.ok, false);
  });
});
