import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractLoyaltyAwardFromWebhook,
  mapKickEventToLoyaltyType,
} from "./loyaltyWebhookEvents.js";

describe("loyaltyWebhookEvents", () => {
  it("mapKickEventToLoyaltyType reconhece tipos conhecidos", () => {
    assert.equal(mapKickEventToLoyaltyType("channel.followed"), "follow");
    assert.equal(mapKickEventToLoyaltyType("channel.subscription.new"), "subscription");
    assert.equal(mapKickEventToLoyaltyType("channel.subscription.gifts"), "gift_sub");
    assert.equal(mapKickEventToLoyaltyType("channel.raid"), "raid");
    assert.equal(mapKickEventToLoyaltyType("chat.message.sent"), null);
  });

  it("extractLoyaltyAwardFromWebhook extrai follow", () => {
    const award = extractLoyaltyAwardFromWebhook(
      "channel.followed",
      {
        broadcaster: { channel_slug: "meu-canal" },
        follower: { user_id: 42, username: "seguidor" },
      },
      "fallback"
    );
    assert.ok(award);
    assert.equal(award?.eventType, "follow");
    assert.equal(award?.channelSlug, "meu-canal");
    assert.equal(award?.user.kickUserId, 42);
    assert.equal(award?.user.username, "seguidor");
  });

  it("extractLoyaltyAwardFromWebhook retorna null sem usuário", () => {
    const award = extractLoyaltyAwardFromWebhook(
      "channel.followed",
      { broadcaster: { channel_slug: "canal" } },
      "canal"
    );
    assert.equal(award, null);
  });
});
