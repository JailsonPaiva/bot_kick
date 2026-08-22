/**
 * SLOs do piloto e expansão (20–50 canais).
 */

import { metrics } from "./metrics.js";

export const SLO_TARGETS = {
  apiAvailability: 0.99,
  apiP95Ms: 500,
  webhookErrorRate: 0.02,
  commandErrorBudget: 0.05,
  wsConnectedRatio: 0.95,
} as const;

export function evaluateSlos() {
  const snap = metrics.snapshot();
  let apiOk = 0;
  let apiErr = 0;
  let worstP95 = 0;
  for (const row of Object.values(snap.api)) {
    apiOk += row.ok;
    apiErr += row.err;
    worstP95 = Math.max(worstP95, row.p95Ms);
  }
  const apiTotal = apiOk + apiErr;
  const availability = apiTotal === 0 ? 1 : apiOk / apiTotal;
  const webhookTotal = snap.webhooks.ok + snap.webhooks.err;
  const webhookErrorRate =
    webhookTotal === 0 ? 0 : snap.webhooks.err / webhookTotal;

  return {
    targets: SLO_TARGETS,
    current: {
      apiAvailability: Number(availability.toFixed(4)),
      apiP95Ms: worstP95,
      webhookErrorRate: Number(webhookErrorRate.toFixed(4)),
      websocketConnected: snap.websocket.connected,
      websocketReconnects: snap.websocket.reconnects,
    },
    passing: {
      apiAvailability: availability >= SLO_TARGETS.apiAvailability,
      apiP95Ms: worstP95 === 0 || worstP95 <= SLO_TARGETS.apiP95Ms,
      webhookErrorRate: webhookErrorRate <= SLO_TARGETS.webhookErrorRate,
    },
  };
}
