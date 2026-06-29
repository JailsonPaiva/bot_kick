import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import type http from "node:http";
import { generateToken } from "../auth.js";
import { createChatRouter, type ChatRouterDeps } from "./chat.js";

const authHeader = {
  Authorization: `Bearer ${generateToken({ userId: "admin", role: "admin" })}`,
};

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
    const deps: ChatRouterDeps = {
      sendMessage: async () => {},
      getAuthenticatedBroadcasterId: async () => 1,
      fetchBroadcasterUserId: async () => 1,
    };

    await withChatServer(deps, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "oi" }),
      });
      assert.equal(res.status, 401);
    });
  });

  it("POST /chat/send retorna 400 com content vazio", async () => {
    const deps: ChatRouterDeps = {
      sendMessage: async () => {},
      getAuthenticatedBroadcasterId: async () => 1,
      fetchBroadcasterUserId: async () => 1,
    };

    await withChatServer(deps, async (baseUrl) => {
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

    const deps: ChatRouterDeps = {
      sendMessage: async (_id, content, options) => {
        sentContent = content;
        useBotPrefix = options?.useBotPrefix;
      },
      getAuthenticatedBroadcasterId: async () => 999,
      fetchBroadcasterUserId: async (slug) => {
        assert.equal(slug, "canal-teste");
        return 123;
      },
    };

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
    const deps: ChatRouterDeps = {
      sendMessage: async () => {
        throw new Error("Falha ao enviar mensagem (HTTP 403)");
      },
      getAuthenticatedBroadcasterId: async () => 1,
      fetchBroadcasterUserId: async () => 1,
    };

    await withChatServer(deps, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content: "teste" }),
      });
      assert.equal(res.status, 502);
    });
  });
});
