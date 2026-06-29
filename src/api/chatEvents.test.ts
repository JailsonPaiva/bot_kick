import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chatRoom, parseJoinChatPayload } from "./chatEvents.js";
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
});
