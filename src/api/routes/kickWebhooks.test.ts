import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import express from "express";
import type http from "node:http";
import { createKickWebhooksRouter } from "./kickWebhooks.js";

const CHAT_PAYLOAD = {
  message_id: "msg-123",
  content: "hello webhook",
  created_at: "2025-01-14T16:08:06Z",
  broadcaster: {
    user_id: 1,
    username: "broadcaster",
    channel_slug: "canal-teste",
  },
  sender: {
    user_id: 2,
    username: "viewer",
  },
};

async function withWebhookServer(
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.use(
    "/api/kick/webhooks",
    express.raw({ type: "application/json" }),
    createKickWebhooksRouter()
  );

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

describe("kickWebhooks route", () => {
  const originalSkip = process.env.KICK_WEBHOOK_SKIP_VERIFY;

  afterEach(() => {
    if (originalSkip === undefined) {
      delete process.env.KICK_WEBHOOK_SKIP_VERIFY;
    } else {
      process.env.KICK_WEBHOOK_SKIP_VERIFY = originalSkip;
    }
  });

  it("POST /events retorna 400 sem headers Kick-Event-*", async () => {
    await withWebhookServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/kick/webhooks/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CHAT_PAYLOAD),
      });

      assert.equal(res.status, 400);
      const json = (await res.json()) as { success: boolean; error: string };
      assert.equal(json.success, false);
      assert.match(json.error, /Headers Kick-Event/i);
    });
  });

  it("POST /events retorna 401 com assinatura inválida quando verificação ativa", async () => {
    delete process.env.KICK_WEBHOOK_SKIP_VERIFY;

    await withWebhookServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/kick/webhooks/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Kick-Event-Message-Id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          "Kick-Event-Message-Timestamp": "2025-01-14T16:08:06Z",
          "Kick-Event-Type": "chat.message.sent",
          "Kick-Event-Version": "1",
          "Kick-Event-Signature": Buffer.from("invalid").toString("base64"),
        },
        body: JSON.stringify(CHAT_PAYLOAD),
      });

      assert.equal(res.status, 401);
    });
  });

  it("POST /events retorna 200 com KICK_WEBHOOK_SKIP_VERIFY=true", async () => {
    process.env.KICK_WEBHOOK_SKIP_VERIFY = "true";

    await withWebhookServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/kick/webhooks/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Kick-Event-Message-Id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          "Kick-Event-Message-Timestamp": "2025-01-14T16:08:06Z",
          "Kick-Event-Type": "chat.message.sent",
          "Kick-Event-Version": "1",
          "Kick-Event-Signature": "dGVzdA==",
        },
        body: JSON.stringify(CHAT_PAYLOAD),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as { success: boolean; ok: boolean };
      assert.equal(json.success, true);
      assert.equal(json.ok, true);
    });
  });
});
