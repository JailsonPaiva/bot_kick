import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapGroupedPointsToRankingEntry,
  mapViewerPointsToRankingEntry,
} from "./publicRanking.js";

describe("publicRanking", () => {
  it("mapViewerPointsToRankingEntry converte BigInt kickUserId para string", () => {
    const entry = mapViewerPointsToRankingEntry({
      kickUserId: 9876543210123n,
      username: "viewer",
      slug: "viewer-slug",
      balance: 150,
    });

    assert.equal(entry.kickUserId, "9876543210123");
    assert.equal(entry.points, 150);
    assert.equal(entry.username, "viewer");
  });

  it("mapGroupedPointsToRankingEntry usa fallback quando viewer ausente", () => {
    const entry = mapGroupedPointsToRankingEntry(42n, 10, null);
    assert.equal(entry.kickUserId, "42");
    assert.equal(entry.username, "user-42");
    assert.equal(entry.points, 10);
  });
});
