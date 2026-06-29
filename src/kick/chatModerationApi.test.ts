import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  banKickUser,
  deleteKickChatMessage,
  unbanKickUser,
  type KickModerationDeps,
} from "./chatModerationApi.js";

function mockDeps(handlers: {
  delete?: (url: string, config?: unknown) => Promise<{ status: number }>;
  post?: (url: string, body: unknown, config?: unknown) => Promise<{ status: number }>;
}): KickModerationDeps {
  return {
    getAccessToken: async () => "test-token",
    http: {
      delete: async (url, config) => {
        if (!handlers.delete) throw new Error("delete não mockado");
        return handlers.delete(url, config);
      },
      post: async (url, body, config) => {
        if (!handlers.post) throw new Error("post não mockado");
        return handlers.post(url, body, config);
      },
    },
  };
}

describe("chatModerationApi", () => {
  it("deleteKickChatMessage chama DELETE /public/v1/chat/{id}", async () => {
    let calledUrl = "";
    const deps = mockDeps({
      delete: async (url) => {
        calledUrl = url;
        return { status: 204 };
      },
    });

    await deleteKickChatMessage("msg-abc", deps);
    assert.match(calledUrl, /\/public\/v1\/chat\/msg-abc$/);
  });

  it("banKickUser envia duration como timeout", async () => {
    let body: Record<string, unknown> | null = null;
    const deps = mockDeps({
      post: async (_url, payload) => {
        body = payload as Record<string, unknown>;
        return { status: 200 };
      },
    });

    await banKickUser(
      {
        broadcasterUserId: 1,
        userId: 2,
        durationMinutes: 15,
        reason: "spam",
      },
      deps
    );

    assert.deepEqual(body, {
      broadcaster_user_id: 1,
      user_id: 2,
      duration: 15,
      reason: "spam",
    });
  });

  it("unbanKickUser envia DELETE com body JSON", async () => {
    let config: { data?: Record<string, unknown> } | undefined;
    const deps = mockDeps({
      delete: async (_url, cfg) => {
        config = cfg as { data?: Record<string, unknown> };
        return { status: 200 };
      },
    });

    await unbanKickUser({ broadcasterUserId: 10, userId: 20 }, deps);
    assert.deepEqual(config?.data, {
      broadcaster_user_id: 10,
      user_id: 20,
    });
  });
});
