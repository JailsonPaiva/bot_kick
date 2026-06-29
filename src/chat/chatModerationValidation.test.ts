import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseBanUserBody,
  parseUnbanUserBody,
  validateChatMessageIdParam,
} from "./chatModerationValidation.js";

describe("chatModerationValidation", () => {
  it("validateChatMessageIdParam aceita id não vazio", () => {
    const result = validateChatMessageIdParam(" msg-123 ");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.messageId, "msg-123");
  });

  it("validateChatMessageIdParam rejeita id vazio", () => {
    assert.equal(validateChatMessageIdParam("  ").ok, false);
  });

  it("parseBanUserBody aceita ban permanente", () => {
    const result = parseBanUserBody({ userId: 42, reason: "spam" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.userId, 42);
      assert.equal(result.value.reason, "spam");
      assert.equal(result.value.durationMinutes, undefined);
    }
  });

  it("parseBanUserBody aceita timeout em minutos", () => {
    const result = parseBanUserBody({ userId: "99", durationMinutes: 10 });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.durationMinutes, 10);
  });

  it("parseBanUserBody rejeita durationMinutes inválido", () => {
    assert.equal(parseBanUserBody({ userId: 1, durationMinutes: 0 }).ok, false);
  });

  it("parseUnbanUserBody exige userId", () => {
    assert.equal(parseUnbanUserBody({}).ok, false);
    const ok = parseUnbanUserBody({ userId: 5, channelSlug: "canal" });
    assert.equal(ok.ok, true);
  });
});
