import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChannelLiveStatus } from "./channelLiveStatus.js";

describe("parseChannelLiveStatus", () => {
  it("detecta live pelo campo stream.is_live", () => {
    const status = parseChannelLiveStatus({
      data: [
        {
          slug: "canal",
          stream_title: "Ranked",
          subscriber_count: 1234,
          stream: { is_live: true, viewer_count: 42 },
        },
      ],
    });
    assert.equal(status.live, true);
    assert.equal(status.viewerCount, 42);
    assert.equal(status.subscriberCount, 1234);
    assert.equal(status.liveDurationSeconds, 0);
    assert.equal(status.streamTitle, "Ranked");
  });

  it("retorna offline quando não está em live", () => {
    const status = parseChannelLiveStatus({
      data: [{ slug: "canal", stream: { is_live: false, viewer_count: 0 } }],
    });
    assert.equal(status.live, false);
    assert.equal(status.viewerCount, 0);
    assert.equal(status.liveDurationSeconds, 0);
  });

  it("aceita payload vazio como offline", () => {
    const status = parseChannelLiveStatus({ data: [] });
    assert.equal(status.live, false);
    assert.equal(status.subscriberCount, 0);
  });

  it("calcula duração da live quando há started_at", () => {
    const startedAt = new Date(Date.now() - 65_000).toISOString();
    const status = parseChannelLiveStatus({
      data: [
        {
          stream: { is_live: true, viewer_count: 10, started_at: startedAt },
        },
      ],
    });
    assert.equal(status.live, true);
    assert.ok(status.liveDurationSeconds >= 60);
  });
});
