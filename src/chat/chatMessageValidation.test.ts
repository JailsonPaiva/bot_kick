import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  parseSendChatBody,
  validateChatMessageContent,
} from "./chatMessageValidation.js";

describe("chatMessageValidation", () => {
  it("validateChatMessageContent aceita texto válido", () => {
    const result = validateChatMessageContent("  Olá chat!  ");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.content, "Olá chat!");
    }
  });

  it("validateChatMessageContent rejeita vazio", () => {
    const result = validateChatMessageContent("   ");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /vazio/i);
    }
  });

  it("validateChatMessageContent rejeita acima do limite Kick", () => {
    const result = validateChatMessageContent("x".repeat(MAX_CHAT_MESSAGE_LENGTH + 1));
    assert.equal(result.ok, false);
  });

  it("parseSendChatBody extrai channelSlug opcional", () => {
    const result = parseSendChatBody({
      content: "teste",
      channelSlug: "  canal-teste ",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.channelSlug, "canal-teste");
    }
  });

  it("parseSendChatBody falha com content inválido", () => {
    const result = parseSendChatBody({ content: 123 });
    assert.equal(result.ok, false);
  });
});
