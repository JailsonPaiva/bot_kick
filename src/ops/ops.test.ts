import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backoffDelay, withRetry } from "./retry.js";
import { eventQueue } from "./eventQueue.js";
import {
  claimWebhookMessage,
  __resetWebhookIdempotencyForTests,
} from "./webhookIdempotency.js";
import {
  isModuleEnabled,
  listFlags,
  setModuleFlag,
} from "./featureFlags.js";
import {
  createSnapshot,
  getSnapshot,
  __resetSnapshotsForTests,
} from "./configSnapshots.js";
import { evaluateSlos, SLO_TARGETS } from "./slo.js";
import { metrics } from "./metrics.js";
import { APP_VERSION } from "./appVersion.js";

describe("ops retry", () => {
  it("withRetry reexecuta e depois sucede", async () => {
    let n = 0;
    const value = await withRetry(async () => {
      n += 1;
      if (n < 3) throw new Error("fail");
      return "ok";
    }, { retries: 3, baseDelayMs: 1, maxDelayMs: 2 });
    assert.equal(value, "ok");
    assert.equal(n, 3);
  });

  it("backoffDelay cresce com a tentativa", () => {
    const a = backoffDelay(0, 100, 10_000);
    const b = backoffDelay(3, 100, 10_000);
    assert.ok(b >= a);
  });
});

describe("ops queue", () => {
  it("processa evento registrado", async () => {
    let seen = "";
    eventQueue.register("alert", async (event) => {
      seen = String((event.payload as { x: string }).x);
    });
    eventQueue.enqueue("alert", { x: "hello" });
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(seen, "hello");
  });
});

describe("webhook idempotency", () => {
  it("rejeita messageId duplicado", async () => {
    __resetWebhookIdempotencyForTests();
    assert.equal(await claimWebhookMessage("m-1"), true);
    assert.equal(await claimWebhookMessage("m-1"), false);
  });
});

describe("feature flags e snapshots", () => {
  it("default ligado e rollback restaura estado", () => {
    __resetSnapshotsForTests();
    assert.equal(isModuleEnabled("canal", "loyalty"), true);
    setModuleFlag("canal", "loyalty", false);
    assert.equal(isModuleEnabled("canal", "loyalty"), false);
    const snap = createSnapshot("canal", "flags", listFlags("canal"));
    setModuleFlag("canal", "loyalty", true);
    const stored = getSnapshot(snap.id);
    assert.ok(stored);
    const payload = stored?.payload as Record<string, boolean>;
    assert.equal(payload.loyalty, false);
  });
});

describe("slo e versão", () => {
  it("expõe alvos e versão 4.0.0", () => {
    assert.equal(APP_VERSION, "4.0.0");
    assert.equal(SLO_TARGETS.apiAvailability, 0.99);
    metrics.recordApi("GET", "/api/health", 200, 12);
    const result = evaluateSlos();
    assert.equal(typeof result.current.apiAvailability, "number");
  });
});
