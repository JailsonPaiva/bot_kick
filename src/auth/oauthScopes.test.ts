import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  KICK_OAUTH_SCOPES,
  hasRequiredScopes,
  missingScopes,
  parseScopeString,
} from "./oauthScopes.js";
import { loadOAuthConfig } from "./oauthFlow.js";

describe("oauthScopes", () => {
  it("inclui events:subscribe nos scopes padrão", () => {
    assert.ok(KICK_OAUTH_SCOPES.includes("events:subscribe"));
  });

  it("inclui scopes de moderação nos scopes padrão", () => {
    assert.ok(KICK_OAUTH_SCOPES.includes("moderation:ban"));
    assert.ok(KICK_OAUTH_SCOPES.includes("moderation:chat_message:manage"));
  });

  it("loadOAuthConfig solicita events:subscribe", () => {
    process.env.KICK_CLIENT_ID = "test-client";
    process.env.KICK_CLIENT_SECRET = "test-secret";
    const config = loadOAuthConfig();
    assert.ok(config.scopes.includes("events:subscribe"));
  });

  it("parseScopeString separa scopes por espaço", () => {
    assert.deepEqual(parseScopeString("user:read chat:write"), [
      "user:read",
      "chat:write",
    ]);
  });

  it("missingScopes detecta scopes ausentes", () => {
    const missing = missingScopes("user:read chat:write", [
      "user:read",
      "events:subscribe",
    ]);
    assert.deepEqual(missing, ["events:subscribe"]);
  });

  it("hasRequiredScopes retorna true quando todos presentes", () => {
    assert.equal(
      hasRequiredScopes(
        "user:read channel:read chat:write events:subscribe moderation:ban moderation:chat_message:manage",
        KICK_OAUTH_SCOPES
      ),
      true
    );
  });
});
