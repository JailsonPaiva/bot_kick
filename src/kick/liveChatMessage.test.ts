import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeKickChatMessage,
  resolveChatChannelSlug,
} from "./liveChatMessage.js";
import type { KickChatMessageSentPayload } from "./webhookTypes.js";

const BASE_PAYLOAD: KickChatMessageSentPayload = {
  message_id: "msg-1",
  content: "Olá [emote:123:wave]",
  created_at: "2025-01-14T16:08:06Z",
  broadcaster: {
    user_id: 10,
    username: "broadcaster",
    channel_slug: "canal-teste",
  },
  sender: {
    user_id: 20,
    username: "viewer",
    profile_picture: "https://kick.com/avatar.webp",
    identity: {
      username_color: "#FF0000",
      badges: [{ type: "subscriber", text: "Sub", count: 3 }],
    },
  },
  replies_to: {
    message_id: "msg-0",
    content: "msg anterior",
    sender: { user_id: 30, username: "mod" },
  },
  emotes: [
    {
      emote_id: "123",
      positions: [{ s: 4, e: 20 }],
    },
  ],
};

describe("liveChatMessage", () => {
  it("resolveChatChannelSlug usa slug do broadcaster", () => {
    assert.equal(resolveChatChannelSlug(BASE_PAYLOAD), "canal-teste");
  });

  it("resolveChatChannelSlug usa fallback quando payload não tem slug", () => {
    const payload: KickChatMessageSentPayload = {
      ...BASE_PAYLOAD,
      broadcaster: { user_id: 10, username: "bc" },
      sender: { user_id: 20, username: "viewer" },
    };
    assert.equal(resolveChatChannelSlug(payload, "fallback-slug"), "fallback-slug");
  });

  it("normalizeKickChatMessage mapeia campos principais", () => {
    const message = normalizeKickChatMessage(BASE_PAYLOAD);
    assert.ok(message);
    assert.equal(message.id, "msg-1");
    assert.equal(message.channelSlug, "canal-teste");
    assert.equal(message.sender.username, "viewer");
    assert.equal(message.sender.color, "#FF0000");
    assert.equal(message.sender.badges[0]?.type, "subscriber");
    assert.equal(message.replyTo?.username, "mod");
    assert.deepEqual(message.emotes?.[0]?.positions, [{ start: 4, end: 20 }]);
  });

  it("normalizeKickChatMessage retorna null sem channel slug", () => {
    const payload: KickChatMessageSentPayload = {
      ...BASE_PAYLOAD,
      broadcaster: { user_id: 10, username: "bc" },
      sender: { user_id: 20, username: "viewer" },
    };
    assert.equal(normalizeKickChatMessage(payload), null);
  });
});
