/**
 * Status de live do canal via API oficial Kick (public/v1/channels).
 */

export interface ChannelLiveStatus {
  live: boolean;
  viewerCount: number;
  subscriberCount: number;
  liveDurationSeconds: number;
  streamTitle: string | null;
  checkedAt: number;
}

export function parseChannelLiveStatus(payload: unknown): ChannelLiveStatus {
  const empty: ChannelLiveStatus = {
    live: false,
    viewerCount: 0,
    subscriberCount: 0,
    liveDurationSeconds: 0,
    streamTitle: null,
    checkedAt: Date.now(),
  };

  const root = asRecord(payload);
  if (!root) return empty;

  const data = root.data;
  const first = Array.isArray(data) ? asRecord(data[0]) : asRecord(data) ?? root;
  if (!first) return empty;

  const stream = asRecord(first.stream) ?? asRecord(first.livestream);
  const liveFromStream = stream
    ? Boolean(stream.is_live ?? stream.isLive)
    : false;
  const liveFromChannel = Boolean(first.is_live ?? first.isLive);
  const live = liveFromStream || liveFromChannel;

  const viewersRaw = stream?.viewer_count ?? stream?.viewerCount ?? first.viewer_count;
  const viewerCount =
    typeof viewersRaw === "number" && Number.isFinite(viewersRaw)
      ? Math.max(0, Math.floor(viewersRaw))
      : 0;

  const streamTitle =
    typeof first.stream_title === "string" && first.stream_title.trim()
      ? first.stream_title.trim()
      : null;

  const subscriberCountRaw =
    first.subscriber_count ??
    first.subscribers_count ??
    first.subscription_count ??
    stream?.subscriber_count ??
    stream?.subscribers_count;
  const subscriberCount =
    typeof subscriberCountRaw === "number" && Number.isFinite(subscriberCountRaw)
      ? Math.max(0, Math.floor(subscriberCountRaw))
      : 0;

  const startedAtRaw =
    stream?.started_at ??
    stream?.created_at ??
    first.stream_started_at ??
    first.started_at;
  const startedAtMs =
    typeof startedAtRaw === "string" ? Date.parse(startedAtRaw) : Number.NaN;
  const liveDurationSeconds =
    live && Number.isFinite(startedAtMs)
      ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
      : 0;

  return {
    live,
    viewerCount: live ? viewerCount : 0,
    subscriberCount,
    liveDurationSeconds,
    streamTitle,
    checkedAt: Date.now(),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
