import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateStoreViewerToken,
  normalizeViewerSlug,
  verifyStoreViewerToken,
} from "./storeViewerAuth.js";

describe("storeViewerAuth", () => {
  it("normaliza slug de viewer para formato seguro", () => {
    assert.equal(normalizeViewerSlug("  João Silva  "), "jo-o-silva");
    assert.equal(normalizeViewerSlug("___"), "___");
  });

  it("gera e valida token de viewer por canal", () => {
    const token = generateStoreViewerToken({
      channelSlug: "canal-x",
      kickUserId: 123,
      username: "viewer",
      slug: "viewer",
    });
    const payload = verifyStoreViewerToken(token);
    assert.ok(payload);
    assert.equal(payload?.role, "store_viewer");
    assert.equal(payload?.channelSlug, "canal-x");
    assert.equal(payload?.kickUserId, 123);
  });

  it("retorna null para token inválido", () => {
    assert.equal(verifyStoreViewerToken("token-invalido"), null);
  });
});
