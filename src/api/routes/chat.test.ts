import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import type http from "node:http";
import { generateToken } from "../auth.js";
import { createChatRouter, type ChatRouterDeps } from "./chat.js";

const authHeader = {
  Authorization: `Bearer ${generateToken({ userId: "admin", role: "admin" })}`,
};

function baseDeps(overrides: Partial<ChatRouterDeps> = {}): ChatRouterDeps {
  return {
    sendMessage: async () => {},
    getAuthenticatedBroadcasterId: async () => 1,
    fetchBroadcasterUserId: async () => 1,
    deleteKickChatMessage: async () => {},
    banKickUser: async () => {},
    unbanKickUser: async () => {},
    ...overrides,
  };
}

async function withChatServer(
  deps: ChatRouterDeps,
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api", createChatRouter(deps));

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe("chat routes", () => {
  it("POST /chat/send retorna 401 sem token", async () => {
    await withChatServer(baseDeps(), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "oi" }),
      });
      assert.equal(res.status, 401);
    });
  });

  it("POST /chat/send retorna 400 com content vazio", async () => {
    await withChatServer(baseDeps(), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content: "   " }),
      });
      assert.equal(res.status, 400);
    });
  });

  it("POST /chat/send envia mensagem sem prefixo [BOT]", async () => {
    let sentContent = "";
    let useBotPrefix: boolean | undefined;

    const deps = baseDeps({
      sendMessage: async (_id, content, options) => {
        sentContent = content;
        useBotPrefix = options?.useBotPrefix;
      },
      getAuthenticatedBroadcasterId: async () => 999,
      fetchBroadcasterUserId: async (slug) => {
        assert.equal(slug, "canal-teste");
        return 123;
      },
    });

    await withChatServer(deps, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Olá chat!",
          channelSlug: "canal-teste",
        }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; data: { broadcasterUserId: number } };
      assert.equal(json.success, true);
      assert.equal(json.data.broadcasterUserId, 123);
      assert.equal(sentContent, "Olá chat!");
      assert.equal(useBotPrefix, false);
    });
  });

  it("POST /chat/send retorna 502 quando Kick falha", async () => {
    await withChatServer(
      baseDeps({
        sendMessage: async () => {
          throw new Error("Falha ao enviar mensagem (HTTP 403)");
        },
      }),
      async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content: "teste" }),
      });
      assert.equal(res.status, 502);
    });
  });

  it("DELETE /chat/:messageId apaga mensagem via proxy", async () => {
    let deletedId = "";
    await withChatServer(
      baseDeps({
        deleteKickChatMessage: async (messageId) => {
          deletedId = messageId;
        },
      }),
      async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/chat/msg-xyz`, {
          method: "DELETE",
          headers: authHeader,
        });
        assert.equal(res.status, 200);
        assert.equal(deletedId, "msg-xyz");
      }
    );
  });

  it("POST /chat/moderation/ban aplica timeout", async () => {
    let banParams: { userId: number; durationMinutes?: number } | null = null;
    await withChatServer(
      baseDeps({
        fetchBroadcasterUserId: async () => 555,
        banKickUser: async (params) => {
          banParams = {
            userId: params.userId,
            durationMinutes: params.durationMinutes,
          };
        },
      }),
      async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/chat/moderation/ban`, {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ userId: 42, durationMinutes: 10 }),
        });
        assert.equal(res.status, 200);
        assert.deepEqual(banParams, { userId: 42, durationMinutes: 10 });
      }
    );
  });

  it("DELETE /chat/moderation/ban remove ban", async () => {
    let unbanUserId = 0;
    await withChatServer(
      baseDeps({
        unbanKickUser: async (params) => {
          unbanUserId = params.userId;
        },
      }),
      async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/chat/moderation/ban`, {
          method: "DELETE",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ userId: 77 }),
        });
        assert.equal(res.status, 200);
        assert.equal(unbanUserId, 77);
      }
    );
  });
});
