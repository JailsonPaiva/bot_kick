import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import express from "express";
import type http from "node:http";
import { generateToken } from "../auth.js";
import { createCommandsRouter } from "./commands.js";
import { createTimersRouter } from "./timers.js";
import { createModerationRouter } from "./moderation.js";
import { prisma } from "../../infra/prisma/client.js";
import { timerService } from "../../timers/timerService.js";

const authHeader = {
  Authorization: `Bearer ${generateToken({ userId: "test-user", role: "admin" })}`,
};

type JsonValue = Record<string, unknown>;

async function withServer(
  routerFactory: () => express.Router,
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api", routerFactory());

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

const originals = {
  commandFindMany: prisma.command.findMany,
  commandCreate: prisma.command.create,
  commandFindUnique: prisma.command.findUnique,
  commandUpdate: prisma.command.update,
  timerCreate: prisma.timer.create,
  timerFindUnique: prisma.timer.findUnique,
  moderationFindUnique: prisma.moderationConfig.findUnique,
  moderationUpsert: prisma.moderationConfig.upsert,
  moderationLogsFindMany: prisma.moderationLog.findMany,
  moderationLogsCount: prisma.moderationLog.count,
  reload: timerService.reload,
};

afterEach(() => {
  prisma.command.findMany = originals.commandFindMany;
  prisma.command.create = originals.commandCreate;
  prisma.command.findUnique = originals.commandFindUnique;
  prisma.command.update = originals.commandUpdate;
  prisma.timer.create = originals.timerCreate;
  prisma.timer.findUnique = originals.timerFindUnique;
  prisma.moderationConfig.findUnique = originals.moderationFindUnique;
  prisma.moderationConfig.upsert = originals.moderationUpsert;
  prisma.moderationLog.findMany = originals.moderationLogsFindMany;
  prisma.moderationLog.count = originals.moderationLogsCount;
  timerService.reload = originals.reload;
});

describe("phase2 routes - commands", () => {
  it("GET /api/commands retorna lista", async () => {
    let receivedWhere: unknown = null;
    prisma.command.findMany = (async (args: unknown) => {
      receivedWhere = (args as { where: unknown }).where;
      return [{ id: "c1", trigger: "discord" }];
    }) as typeof prisma.command.findMany;

    await withServer(createCommandsRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/commands?channel=canal`, {
        headers: authHeader,
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, true);
      assert.deepEqual(receivedWhere, { channelSlug: "canal" });
    });
  });

  it("POST /api/commands valida trigger/response obrigatórios", async () => {
    await withServer(createCommandsRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/commands`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "" }),
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, false);
    });
  });

  it("PATCH /api/commands/:id/toggle retorna 404 quando não encontra", async () => {
    prisma.command.findUnique = (async () => null) as typeof prisma.command.findUnique;

    await withServer(createCommandsRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/commands/c1/toggle`, {
        method: "PATCH",
        headers: authHeader,
      });
      assert.equal(res.status, 404);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, false);
    });
  });
});

describe("phase2 routes - timers", () => {
  it("POST /api/timers cria timer e recarrega scheduler", async () => {
    let reloadCalls = 0;
    timerService.reload = (async () => {
      reloadCalls++;
    }) as typeof timerService.reload;

    prisma.timer.create = (async (args: unknown) => {
      const data = (args as { data: Record<string, unknown> }).data;
      return { id: "t1", ...data };
    }) as typeof prisma.timer.create;

    await withServer(createTimersRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/timers`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          channelSlug: "canal",
          name: "promo",
          messages: ["msg1", "msg2"],
          intervalMinutes: 10,
        }),
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, true);
      assert.equal(reloadCalls, 1);
    });
  });

  it("PATCH /api/timers/:id/toggle retorna 404 quando não encontra", async () => {
    prisma.timer.findUnique = (async () => null) as typeof prisma.timer.findUnique;

    await withServer(createTimersRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/timers/t1/toggle`, {
        method: "PATCH",
        headers: authHeader,
      });
      assert.equal(res.status, 404);
    });
  });
});

describe("phase2 routes - moderation", () => {
  it("GET /api/moderation retorna config padrão quando não existe", async () => {
    prisma.moderationConfig.findUnique =
      (async () => null) as typeof prisma.moderationConfig.findUnique;

    await withServer(createModerationRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/moderation?channel=canal`, {
        headers: authHeader,
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, true);
      const data = body.data as JsonValue;
      assert.equal(data.actionType, "warn");
      assert.equal(data.linksEnabled, false);
    });
  });

  it("PUT /api/moderation faz upsert e retorna config", async () => {
    prisma.moderationConfig.upsert = (async (args: unknown) => {
      const input = args as { create: Record<string, unknown>; update: Record<string, unknown> };
      return {
        id: "m1",
        channelSlug: "canal",
        linksEnabled: input.create.linksEnabled,
        linksWhitelist: input.create.linksWhitelist,
      };
    }) as typeof prisma.moderationConfig.upsert;

    await withServer(createModerationRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/moderation`, {
        method: "PUT",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          channelSlug: "canal",
          linksEnabled: true,
          linksWhitelist: ["kick.com"],
        }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, true);
    });
  });

  it("GET /api/moderation/logs pagina logs", async () => {
    prisma.moderationLog.findMany = (async () => [
      { id: "l1", reason: "spam" },
    ]) as typeof prisma.moderationLog.findMany;
    prisma.moderationLog.count = (async () => 1) as typeof prisma.moderationLog.count;

    await withServer(createModerationRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/moderation/logs?channel=canal&page=1&limit=10`, {
        headers: authHeader,
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, true);
      const data = body.data as JsonValue;
      assert.equal(data.total, 1);
      assert.equal(data.totalPages, 1);
    });
  });
});
