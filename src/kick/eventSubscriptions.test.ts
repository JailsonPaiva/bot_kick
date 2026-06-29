import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChatWebhookSubscribeBody,
  extractCreatedSubscriptionId,
  findChatMessageSentSubscription,
  ensureChatWebhookSubscription,
  isChatMessageSentSubscription,
  listEventSubscriptions,
  subscribeToChatWebhook,
  type EventSubscriptionsDeps,
} from "./eventSubscriptions.js";
import type {
  KickCreatedEventSubscription,
  KickEventSubscription,
} from "./eventSubscriptionTypes.js";

const CHAT_SUBSCRIPTION: KickEventSubscription = {
  id: "sub-existing",
  app_id: "app-1",
  broadcaster_user_id: 123,
  event: "chat.message.sent",
  version: 1,
  method: "webhook",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

function mockDeps(handlers: {
  get?: () => Promise<{ data: { data: KickEventSubscription[] } }>;
  post?: () => Promise<{ data: { data: KickCreatedEventSubscription[] } }>;
}): EventSubscriptionsDeps {
  return {
    getAccessToken: async () => "test-token",
    http: {
      get: async () => {
        if (!handlers.get) {
          throw new Error("GET não mockado");
        }
        return handlers.get();
      },
      post: async () => {
        if (!handlers.post) {
          throw new Error("POST não mockado");
        }
        return handlers.post();
      },
    },
  };
}

describe("eventSubscriptions helpers", () => {
  it("buildChatWebhookSubscribeBody monta payload webhook chat.message.sent v1", () => {
    const body = buildChatWebhookSubscribeBody();
    assert.equal(body.method, "webhook");
    assert.deepEqual(body.events, [{ name: "chat.message.sent", version: 1 }]);
    assert.equal(body.broadcaster_user_id, undefined);
  });

  it("isChatMessageSentSubscription identifica inscrição correta", () => {
    assert.equal(isChatMessageSentSubscription(CHAT_SUBSCRIPTION), true);
    assert.equal(
      isChatMessageSentSubscription({
        ...CHAT_SUBSCRIPTION,
        event: "channel.followed",
      }),
      false
    );
  });

  it("findChatMessageSentSubscription retorna primeira inscrição compatível", () => {
    const found = findChatMessageSentSubscription([
      {
        ...CHAT_SUBSCRIPTION,
        id: "other",
        event: "channel.followed",
      },
      CHAT_SUBSCRIPTION,
    ]);
    assert.equal(found?.id, "sub-existing");
  });

  it("extractCreatedSubscriptionId retorna subscription_id válido", () => {
    const id = extractCreatedSubscriptionId([
      {
        name: "chat.message.sent",
        version: 1,
        subscription_id: "sub-new",
      },
    ]);
    assert.equal(id, "sub-new");
  });

  it("extractCreatedSubscriptionId falha se Kick retornar error", () => {
    assert.throws(
      () =>
        extractCreatedSubscriptionId([
          {
            name: "chat.message.sent",
            version: 1,
            error: "limite excedido",
          },
        ]),
      /limite excedido/
    );
  });
});

describe("eventSubscriptions API", () => {
  it("listEventSubscriptions retorna data da Kick", async () => {
    const deps = mockDeps({
      get: async () => ({ data: { data: [CHAT_SUBSCRIPTION] } }),
    });

    const subs = await listEventSubscriptions(deps);
    assert.equal(subs.length, 1);
    assert.equal(subs[0].id, "sub-existing");
  });

  it("subscribeToChatWebhook cria inscrição e retorna subscription_id", async () => {
    const deps = mockDeps({
      post: async () => ({
        data: {
          data: [
            {
              name: "chat.message.sent",
              version: 1,
              subscription_id: "sub-created",
            },
          ],
        },
      }),
    });

    const id = await subscribeToChatWebhook(deps);
    assert.equal(id, "sub-created");
  });

  it("ensureChatWebhookSubscription reutiliza inscrição existente", async () => {
    const deps = mockDeps({
      get: async () => ({ data: { data: [CHAT_SUBSCRIPTION] } }),
    });

    const result = await ensureChatWebhookSubscription(deps);
    assert.equal(result.subscriptionId, "sub-existing");
    assert.equal(result.created, false);
  });

  it("ensureChatWebhookSubscription cria inscrição quando ausente", async () => {
    let postCalls = 0;
    const deps = mockDeps({
      get: async () => ({ data: { data: [] } }),
      post: async () => {
        postCalls += 1;
        return {
          data: {
            data: [
              {
                name: "chat.message.sent",
                version: 1,
                subscription_id: "sub-new",
              },
            ],
          },
        };
      },
    });

    const result = await ensureChatWebhookSubscription(deps);
    assert.equal(result.subscriptionId, "sub-new");
    assert.equal(result.created, true);
    assert.equal(postCalls, 1);
  });
});
