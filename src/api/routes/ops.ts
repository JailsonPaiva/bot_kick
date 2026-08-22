/**
 * Rotas operacionais do piloto: flags, snapshots, checklist.
 */

import { Router } from "express";
import { authMiddleware } from "../auth.js";
import type { AuthRequest } from "../types.js";
import {
  FLAG_MODULES,
  isKnownModule,
  listFlags,
  setModuleFlag,
} from "../../ops/featureFlags.js";
import {
  createSnapshot,
  getSnapshot,
  listSnapshots,
} from "../../ops/configSnapshots.js";
import { evaluateSlos } from "../../ops/slo.js";
import { metrics } from "../../ops/metrics.js";
import { runtimeHealth } from "../../ops/runtimeHealth.js";
import { APP_VERSION } from "../../ops/appVersion.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

const PILOT_CHECKLIST = [
  "Health /api/health não está down",
  "WebSocket connected em /api/metrics",
  "Webhook Kick inscrito e recebendo eventos",
  "Login dashboard com JWT de 24h",
  "Flags do canal conferidas",
  "Snapshot de config criado antes de mudanças grandes",
  "Revisão diária de erros 5xx e reconnects",
];

export function createOpsRouter(): Router {
  const router = Router();

  router.get("/ops/flags", authMiddleware, (req, res) => {
    const channelSlug = String(req.query.channel ?? DEFAULT_CHANNEL);
    res.json({
      success: true,
      data: { channelSlug, modules: FLAG_MODULES, flags: listFlags(channelSlug) },
    });
  });

  router.put("/ops/flags", authMiddleware, (req, res) => {
    const channelSlug = String(req.body.channelSlug ?? DEFAULT_CHANNEL);
    const module = String(req.body.module ?? "");
    const enabled = Boolean(req.body.enabled);
    if (!isKnownModule(module)) {
      res.status(400).json({ success: false, error: "módulo inválido" });
      return;
    }
    const before = listFlags(channelSlug);
    createSnapshot(channelSlug, "flags", before, (req as AuthRequest).userId ?? "admin");
    setModuleFlag(channelSlug, module, enabled);
    res.json({
      success: true,
      data: { channelSlug, flags: listFlags(channelSlug) },
    });
  });

  router.get("/ops/snapshots", authMiddleware, (req, res) => {
    const channelSlug = String(req.query.channel ?? DEFAULT_CHANNEL);
    const module = req.query.module ? String(req.query.module) : undefined;
    res.json({ success: true, data: listSnapshots(channelSlug, module) });
  });

  router.post("/ops/snapshots", authMiddleware, (req, res) => {
    const channelSlug = String(req.body.channelSlug ?? DEFAULT_CHANNEL);
    const module = String(req.body.module ?? "flags");
    const payload = req.body.payload ?? listFlags(channelSlug);
    const snap = createSnapshot(channelSlug, module, payload, (req as AuthRequest).userId ?? "admin");
    res.status(201).json({ success: true, data: snap });
  });

  router.post("/ops/snapshots/:id/restore", authMiddleware, (req, res) => {
    const snap = getSnapshot(String(req.params.id));
    if (!snap) {
      res.status(404).json({ success: false, error: "snapshot não encontrado" });
      return;
    }
    if (snap.module === "flags" && snap.payload && typeof snap.payload === "object") {
      for (const [module, enabled] of Object.entries(
        snap.payload as Record<string, boolean>
      )) {
        if (isKnownModule(module)) {
          setModuleFlag(snap.channelSlug, module, Boolean(enabled));
        }
      }
    }
    res.json({
      success: true,
      data: { restored: snap.id, flags: listFlags(snap.channelSlug) },
    });
  });

  router.get("/ops/pilot", authMiddleware, (_req, res) => {
    res.json({
      success: true,
      data: {
        version: APP_VERSION,
        checklist: PILOT_CHECKLIST,
        slo: evaluateSlos(),
        metrics: metrics.snapshot(),
        websocket: runtimeHealth.getWs(),
        queueDepth: runtimeHealth.getQueueDepth(),
        targetChannels: { min: 5, max: 15, scaleNext: "20-50" },
      },
    });
  });

  router.put("/ops/viewers", authMiddleware, (req, res) => {
    const channelSlug = String(req.body.channelSlug ?? DEFAULT_CHANNEL);
    const count = Number.parseInt(String(req.body.viewerCount ?? "0"), 10) || 0;
    runtimeHealth.setViewerCount(channelSlug, count);
    res.json({
      success: true,
      data: { channelSlug, viewerCount: runtimeHealth.getViewerCount(channelSlug) },
    });
  });

  return router;
}
