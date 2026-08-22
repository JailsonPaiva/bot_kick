import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import express from "express";
import type http from "node:http";
import { generateToken } from "../auth.js";
import { createCommandsRouter } from "./commands.js";
import { createTimersRouter } from "./timers.js";
import { createModerationRouter } from "./moderation.js";
import { createGiveawaysRouter } from "./giveaways.js";
import { createPollsRouter } from "./polls.js";
import { prisma } from "../../infra/prisma/client.js";
import { timerService } from "../../timers/timerService.js";
import { pollService } from "../../engagement/pollService.js";

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
  giveawayWidgetFindUnique: prisma.giveawayWidgetConfig.findUnique,
  giveawayWidgetUpsert: prisma.giveawayWidgetConfig.upsert,
  pollCreate: pollService.create,
  pollClose: pollService.close,
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
  prisma.giveawayWidgetConfig.findUnique = originals.giveawayWidgetFindUnique;
  prisma.giveawayWidgetConfig.upsert = originals.giveawayWidgetUpsert;
  pollService.create = originals.pollCreate;
  pollService.close = originals.pollClose;
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
      assert.equal(data.linksActionType, "warn");
      assert.equal(data.bannedActionType, "warn");
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

  it("PUT /api/moderation valida e salva penalidade por filtro", async () => {
    let receivedCreate: Record<string, unknown> | null = null;
    prisma.moderationConfig.upsert = (async (args: unknown) => {
      const input = args as { create: Record<string, unknown> };
      receivedCreate = input.create;
      return { id: "m2", channelSlug: "canal", ...input.create };
    }) as typeof prisma.moderationConfig.upsert;

    await withServer(createModerationRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/moderation`, {
        method: "PUT",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          channelSlug: "canal",
          linksActionType: "delete",
          capsActionType: "timeout",
          capsTimeoutDurationMinutes: 9,
        }),
      });
      assert.equal(res.status, 200);
      assert.ok(receivedCreate);
      assert.equal(receivedCreate.linksActionType, "delete");
      assert.equal(receivedCreate.capsActionType, "timeout");
      assert.equal(receivedCreate.capsTimeoutDurationMinutes, 9);
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

describe("phase2 routes - giveaways widget config", () => {
  it("GET /api/giveaways/widget-config retorna padrão quando não existe", async () => {
    prisma.giveawayWidgetConfig.findUnique =
      (async () => null) as typeof prisma.giveawayWidgetConfig.findUnique;

    await withServer(createGiveawaysRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/giveaways/widget-config?channel=canal`, {
        headers: authHeader,
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, true);
      const data = body.data as JsonValue;
      assert.equal(data.animationDurationMs, 3600);
      assert.equal(data.confettiEnabled, true);
    });
  });

  it("PUT /api/giveaways/widget-config salva configuração por canal", async () => {
    prisma.giveawayWidgetConfig.upsert = (async (args: unknown) => {
      const input = args as { create: Record<string, unknown> };
      return { id: "gw1", ...input.create };
    }) as typeof prisma.giveawayWidgetConfig.upsert;

    await withServer(createGiveawaysRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/giveaways/widget-config`, {
        method: "PUT",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          channelSlug: "canal",
          animationDurationMs: 8000,
          confettiEnabled: false,
          soundEnabled: true,
          showTopParticipants: true,
          topParticipantsLimit: 7,
        }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, true);
      const data = body.data as JsonValue;
      assert.equal(data.animationDurationMs, 8000);
      assert.equal(data.soundEnabled, true);
      assert.equal(data.topParticipantsLimit, 7);
    });
  });
});

describe("phase2 routes - polls", () => {
  it("POST /api/polls cria enquete com payload válido", async () => {
    pollService.create = (async () => ({
      id: "p1",
      channelSlug: "canal",
      question: "Pergunta?",
      options: ["A", "B"],
      durationS: 120,
      weightedSubs: false,
      status: "open",
      createdAt: new Date(),
      closesAt: new Date(),
    })) as typeof pollService.create;

    await withServer(createPollsRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/polls`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Pergunta?",
          options: ["A", "B"],
          durationS: 120,
        }),
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, true);
    });
  });

  it("POST /api/polls/end retorna erro de validação quando sem enquete aberta", async () => {
    pollService.close = (async () => ({
      ok: false,
      error: "Nenhuma enquete aberta para encerrar.",
    })) as typeof pollService.close;

    await withServer(createPollsRouter, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/polls/end`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as JsonValue;
      assert.equal(body.success, false);
    });
  });
});
