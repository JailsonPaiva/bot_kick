import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWebhookPublicUrl,
  formatE2ECheckReport,
  runWebhookE2EChecks,
  summarizeE2EChecks,
} from "./webhookE2ECheck.js";

describe("webhookE2ECheck", () => {
  it("buildWebhookPublicUrl monta URL do portal", () => {
    assert.equal(
      buildWebhookPublicUrl("https://abc.trycloudflare.com/", "/api/kick/webhooks/events"),
      "https://abc.trycloudflare.com/api/kick/webhooks/events"
    );
  });

  it("summarizeE2EChecks detecta falhas", () => {
    const summary = summarizeE2EChecks([
      { name: "a", ok: true, detail: "ok" },
      { name: "b", ok: false, detail: "fail" },
    ]);
    assert.equal(summary.allOk, false);
    assert.equal(summary.failed.length, 1);
  });

  it("formatE2ECheckReport inclui status final", () => {
    const report = formatE2ECheckReport([
      { name: "Health", ok: true, detail: "200" },
    ]);
    assert.match(report, /\[OK\] Health/);
    assert.match(report, /Checklist pré-voo OK/);
  });

  it("runWebhookE2EChecks falha sem PUBLIC_API_URL", async () => {
    const checks = await runWebhookE2EChecks({
      publicApiUrl: "",
      fetchFn: async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      listSubscriptions: async () => [],
    });

    const publicUrlCheck = checks.find((item) => item.name === "PUBLIC_API_URL");
    assert.equal(publicUrlCheck?.ok, false);
  });

  it("runWebhookE2EChecks valida health e inscrição com mocks", async () => {
    const checks = await runWebhookE2EChecks({
      publicApiUrl: "https://tunnel.test",
      webhookPath: "/api/kick/webhooks/events",
      localApiUrl: "http://127.0.0.1:3001",
      skipVerify: true,
      fetchFn: async (url, init) => {
        if (url.includes("/api/health")) {
          return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
        }
        if (init?.method === "POST") {
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        return new Response("not found", { status: 404 });
      },
      listSubscriptions: async () => [
        {
          id: "sub-1",
          app_id: "app",
          broadcaster_user_id: 1,
          event: "chat.message.sent",
          version: 1,
          method: "webhook",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ],
    });

    const summary = summarizeE2EChecks(checks);
    assert.equal(summary.allOk, true);
  });
});
