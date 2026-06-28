import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  __resetModerationStateForTests,
  checkModeration,
} from "./moderationService.js";
import type { ChatMessage } from "../chat/types.js";

function makeMessage(
  content: string,
  userId = 99,
  username = "viewer",
  badges: Array<{ type: string; text: string }> = []
): ChatMessage {
  return {
    id: `${userId}-${Date.now()}`,
    content,
    chatroom_id: 1,
    created_at: new Date().toISOString(),
    sender: {
      id: userId,
      username,
      slug: username.toLowerCase(),
      identity: { color: "#fff", badges },
    },
  };
}

describe("moderationService", () => {
  beforeEach(() => {
    __resetModerationStateForTests();
  });

  it("não bloqueia quando não há config", async () => {
    const result = await checkModeration(makeMessage("hello"), "canal", 10, {
      getConfig: async () => null,
      logViolation: async () => {},
      send: async () => {},
    });
    assert.equal(result.blocked, false);
  });

  it("ignora moderação para moderador", async () => {
    const result = await checkModeration(
      makeMessage("VISITE http://spam.com", 1, "mod", [{ type: "moderator", text: "MOD" }]),
      "canal",
      10,
      {
        getConfig: async () => ({
          linksEnabled: true,
          linksWhitelist: [],
          capsEnabled: true,
          capsPercent: 10,
          spamEnabled: true,
          spamWindow: 1,
          bannedWords: ["spam"],
          actionType: "warn",
        }),
        logViolation: async () => {
          throw new Error("não deveria logar");
        },
        send: async () => {
          throw new Error("não deveria enviar");
        },
      }
    );
    assert.equal(result.blocked, false);
  });

  it("bloqueia link fora da whitelist e registra log", async () => {
    const sent: string[] = [];
    const logs: string[] = [];

    const result = await checkModeration(
      makeMessage("acesse http://site-malicioso.com/agora"),
      "canal",
      10,
      {
        getConfig: async () => ({
          linksEnabled: true,
          linksWhitelist: ["kick.com"],
          capsEnabled: false,
          capsPercent: 70,
          spamEnabled: false,
          spamWindow: 3,
          bannedWords: [],
          actionType: "warn",
        }),
        logViolation: async (_channel, _msg, reason) => {
          logs.push(reason);
        },
        send: async (_id, content) => {
          sent.push(content);
        },
      }
    );

    assert.equal(result.blocked, true);
    assert.equal(result.reason, "link não permitido");
    assert.equal(sent.length, 1);
    assert.equal(logs.length, 1);
  });

  it("detecta spam por repetição em sequência", async () => {
    const deps = {
      getConfig: async () => ({
        linksEnabled: false,
        linksWhitelist: [],
        capsEnabled: false,
        capsPercent: 70,
        spamEnabled: true,
        spamWindow: 2,
        bannedWords: [],
        actionType: "warn",
      }),
      logViolation: async () => {},
      send: async () => {},
    };

    const first = await checkModeration(makeMessage("hello", 42), "canal", 10, deps);
    const second = await checkModeration(makeMessage("hello", 42), "canal", 10, deps);
    const third = await checkModeration(makeMessage("hello", 42), "canal", 10, deps);

    assert.equal(first.blocked, false);
    assert.equal(second.blocked, false);
    assert.equal(third.blocked, true);
    assert.equal(third.reason, "spam detectado");
  });
});
