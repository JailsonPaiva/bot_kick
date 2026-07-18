import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  __resetModerationStateForTests,
  checkModeration,
  clampTimeoutDurationMinutes,
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

const baseConfig = {
  linksEnabled: false,
  linksWhitelist: [] as string[],
  capsEnabled: false,
  capsPercent: 70,
  spamEnabled: false,
  spamWindow: 3,
  bannedWords: [] as string[],
  actionType: "warn",
  timeoutDurationMinutes: 1,
};

describe("clampTimeoutDurationMinutes", () => {
  it("aceita valores válidos e limita extremos", () => {
    assert.equal(clampTimeoutDurationMinutes(5), 5);
    assert.equal(clampTimeoutDurationMinutes(0), 1);
    assert.equal(clampTimeoutDurationMinutes(20_000), 10_080);
    assert.equal(clampTimeoutDurationMinutes("abc"), 1);
  });
});

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
          ...baseConfig,
          linksEnabled: true,
          capsEnabled: true,
          capsPercent: 10,
          spamEnabled: true,
          spamWindow: 1,
          bannedWords: ["spam"],
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
          ...baseConfig,
          linksEnabled: true,
          linksWhitelist: ["kick.com"],
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
        ...baseConfig,
        spamEnabled: true,
        spamWindow: 2,
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

  it("aplica timeout com duração configurada", async () => {
    const timeouts: Array<{ userId: number; minutes: number }> = [];

    const result = await checkModeration(
      makeMessage("palavra-ruim aqui"),
      "canal",
      10,
      {
        getConfig: async () => ({
          ...baseConfig,
          bannedWords: ["palavra-ruim"],
          actionType: "timeout",
          timeoutDurationMinutes: 10,
        }),
        logViolation: async () => {},
        send: async () => {},
        applyTimeout: async (_bc, userId, minutes) => {
          timeouts.push({ userId, minutes });
        },
      }
    );

    assert.equal(result.blocked, true);
    assert.deepEqual(timeouts, [{ userId: 99, minutes: 10 }]);
  });
});
