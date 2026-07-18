import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handleKickWebhookEvent,
  handleKickWebhookEventFull,
} from "./webhookHandler.js";
import type { KickWebhookHeaders } from "./webhookTypes.js";

const HEADERS: KickWebhookHeaders = {
  messageId: "msg-id",
  signature: "sig",
  timestamp: "2025-01-14T16:08:06Z",
  eventType: "chat.message.sent",
  eventVersion: "1",
};

describe("webhookHandler", () => {
  it("handleKickWebhookEvent retorna LiveChatMessage para chat.message.sent", () => {
    const message = handleKickWebhookEvent(HEADERS, {
      message_id: "abc",
      content: "teste",
      created_at: "2025-01-14T16:08:06Z",
      broadcaster: {
        user_id: 1,
        username: "bc",
        channel_slug: "canal-teste",
      },
      sender: {
        user_id: 2,
        username: "viewer",
      },
    });

    assert.ok(message);
    assert.equal(message?.id, "abc");
    assert.equal(message?.channelSlug, "canal-teste");
  });

  it("handleKickWebhookEvent retorna null para evento sem chat (follow)", () => {
    const result = handleKickWebhookEvent(
      { ...HEADERS, eventType: "channel.followed" },
      { follower: { user_id: 1 } }
    );
    assert.equal(result, null);
  });

  it("handleKickWebhookEventFull extrai award de follow", () => {
    const full = handleKickWebhookEventFull(
      { ...HEADERS, eventType: "channel.followed" },
      {
        broadcaster: { channel_slug: "canal-x" },
        follower: { user_id: 9, username: "fa" },
      }
    );
    assert.equal(full.chatMessage, null);
    assert.ok(full.loyaltyAward);
    assert.equal(full.loyaltyAward?.eventType, "follow");
    assert.equal(full.loyaltyAward?.user.kickUserId, 9);
  });
});
