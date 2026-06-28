import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  __resetCustomCommandStateForTests,
  tryExecuteCustomCommand,
} from "./customCommands.js";
import type { ChatMessage } from "../chat/types.js";

function makeMessage(
  username: string,
  badges: Array<{ type: string; text: string }> = []
): ChatMessage {
  return {
    id: "msg-1",
    content: "!discord",
    chatroom_id: 1,
    created_at: new Date().toISOString(),
    sender: {
      id: 123,
      username,
      slug: username.toLowerCase(),
      identity: { color: "#fff", badges },
    },
  };
}

describe("customCommands", () => {
  beforeEach(() => {
    __resetCustomCommandStateForTests();
  });

  it("retorna false quando comando não existe", async () => {
    const handled = await tryExecuteCustomCommand(
      "discord",
      "canal",
      makeMessage("alice"),
      10,
      {
        findCommand: async () => null,
        incrementUsage: async () => {},
        send: async () => {},
        now: () => 1_000,
      }
    );

    assert.equal(handled, false);
  });

  it("silencia execução sem permissão", async () => {
    const sent: string[] = [];
    const handled = await tryExecuteCustomCommand(
      "modonly",
      "canal",
      makeMessage("viewer"),
      10,
      {
        findCommand: async () => ({
          id: "c1",
          response: "oi",
          usageCount: 0,
          permission: "moderators",
          cooldown: 0,
        }),
        incrementUsage: async () => {
          throw new Error("não deveria incrementar");
        },
        send: async (_id, content) => {
          sent.push(content);
        },
        now: () => 1_000,
      }
    );

    assert.equal(handled, true);
    assert.equal(sent.length, 0);
  });

  it("executa comando e substitui variáveis", async () => {
    const sent: string[] = [];
    let increments = 0;

    const handled = await tryExecuteCustomCommand(
      "discord",
      "canal",
      makeMessage("alice"),
      10,
      {
        findCommand: async () => ({
          id: "c1",
          response: "Olá {user} #{count} em {date} uptime {uptime}",
          usageCount: 2,
          permission: "everyone",
          cooldown: 0,
        }),
        incrementUsage: async () => {
          increments++;
        },
        send: async (_id, content) => {
          sent.push(content);
        },
        now: () => Date.UTC(2026, 0, 2, 10, 0, 0),
      }
    );

    assert.equal(handled, true);
    assert.equal(increments, 1);
    assert.equal(sent.length, 1);
    assert.match(sent[0] ?? "", /@alice/);
    assert.match(sent[0] ?? "", /#3/);
    assert.match(sent[0] ?? "", /02\/01\/2026/);
  });

  it("aplica cooldown por comando e usuário", async () => {
    let sends = 0;
    let increments = 0;
    const now = 10_000;
    const deps = {
      findCommand: async () => ({
        id: "c1",
        response: "ok",
        usageCount: 0,
        permission: "everyone",
        cooldown: 30,
      }),
      incrementUsage: async () => {
        increments++;
      },
      send: async () => {
        sends++;
      },
      now: () => now,
    };

    const msg = makeMessage("alice");
    const first = await tryExecuteCustomCommand("discord", "canal", msg, 10, deps);
    const second = await tryExecuteCustomCommand("discord", "canal", msg, 10, deps);

    assert.equal(first, true);
    assert.equal(second, true);
    assert.equal(sends, 1);
    assert.equal(increments, 1);
  });
});
