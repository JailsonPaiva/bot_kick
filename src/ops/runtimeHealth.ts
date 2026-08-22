/**
 * Estado runtime do bot para healthcheck profundo.
 */

export type WsHealthState = "disconnected" | "connecting" | "connected";

let wsState: WsHealthState = "disconnected";
let lastWsError: string | null = null;
let queueDepth = 0;
const viewerCounts = new Map<string, { count: number; updatedAt: number }>();

export const runtimeHealth = {
  setWs(state: WsHealthState, error?: string): void {
    wsState = state;
    lastWsError = error ?? null;
  },

  getWs(): { state: WsHealthState; lastError: string | null } {
    return { state: wsState, lastError: lastWsError };
  },

  setQueueDepth(n: number): void {
    queueDepth = Math.max(0, n);
  },

  getQueueDepth(): number {
    return queueDepth;
  },

  setViewerCount(channelSlug: string, count: number): void {
    viewerCounts.set(channelSlug, { count: Math.max(0, count), updatedAt: Date.now() });
  },

  getViewerCount(channelSlug: string): number {
    return viewerCounts.get(channelSlug)?.count ?? 0;
  },
};
