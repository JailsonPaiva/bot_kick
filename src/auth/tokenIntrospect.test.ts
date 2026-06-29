import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTokenHasScopes,
  formatScopeCheck,
  type TokenIntrospectResult,
} from "./tokenIntrospect.js";

describe("tokenIntrospect helpers", () => {
  it("assertTokenHasScopes falha se token inativo", () => {
    assert.throws(
      () =>
        assertTokenHasScopes(
          { active: false, scope: "events:subscribe" },
          ["events:subscribe"]
        ),
      /inativo/
    );
  });

  it("assertTokenHasScopes falha se events:subscribe ausente", () => {
    assert.throws(
      () =>
        assertTokenHasScopes(
          { active: true, scope: "user:read chat:write" },
          ["events:subscribe"]
        ),
      /events:subscribe/
    );
  });

  it("assertTokenHasScopes passa com scope correto", () => {
    assert.doesNotThrow(() =>
      assertTokenHasScopes(
        {
          active: true,
          scope: "user:read channel:read chat:write events:subscribe",
        },
        ["events:subscribe"]
      )
    );
  });

  it("formatScopeCheck indica presença de events:subscribe", () => {
    const withScope: TokenIntrospectResult = {
      active: true,
      scope: "user:read events:subscribe",
    };
    const withoutScope: TokenIntrospectResult = {
      active: true,
      scope: "user:read chat:write",
    };

    assert.match(formatScopeCheck(withScope), /presente/);
    assert.match(formatScopeCheck(withoutScope), /AUSENTE/);
  });
});
