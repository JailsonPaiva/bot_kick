import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  __getChatHistoryForTests,
  __resetChatHistoryForTests,
  broadcastChatMessage,
  chatRoom,
  parseJoinChatPayload,
} from "./chatEvents.js";
import type { JWTPayload } from "./auth.js";

describe("chatEvents", () => {
  it("chatRoom prefixa slug com chat:", () => {
    assert.equal(chatRoom("canal-teste"), "chat:canal-teste");
  });

  it("parseJoinChatPayload rejeita sem token", () => {
    const result = parseJoinChatPayload({ channelSlug: "canal" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Token/i);
    }
  });

  it("parseJoinChatPayload rejeita token inválido", () => {
    const result = parseJoinChatPayload(
      { token: "bad", channelSlug: "canal" },
      () => null
    );
    assert.equal(result.ok, false);
  });

  it("parseJoinChatPayload rejeita role diferente de admin", () => {
    const result = parseJoinChatPayload(
      { token: "ok", channelSlug: "canal" },
      () => ({ userId: "player", role: "player" })
    );
    assert.equal(result.ok, false);
  });

  it("parseJoinChatPayload aceita admin com channelSlug", () => {
    const verify = (_token: string): JWTPayload => ({
      userId: "admin",
      role: "admin",
    });

    const result = parseJoinChatPayload(
      { token: "jwt", channelSlug: "unao-da-firma" },
      verify
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.channelSlug, "unao-da-firma");
    }
  });

  it("guarda histórico limitado por canal para reentrada", () => {
    __resetChatHistoryForTests();
    const channel = "canal-teste";

    for (let i = 0; i < 220; i++) {
      broadcastChatMessage(channel, {
        id: `m-${i}`,
        content: `msg ${i}`,
        createdAt: new Date().toISOString(),
        channelSlug: channel,
        sender: {
          userId: 1,
          username: "viewer",
          badges: [],
        },
      });
    }

    const history = __getChatHistoryForTests(channel);
    assert.equal(history.length, 200);
    assert.equal(history[0]?.id, "m-20");
    assert.equal(history[history.length - 1]?.id, "m-219");
  });
});
