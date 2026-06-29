/**
 * Rotas de configuração e teste de alertas em tempo real.
 */

import { Router } from "express";
import { prisma } from "../../infra/prisma/client.js";
import { authMiddleware } from "../auth.js";
import type { ApiResponse } from "../types.js";
import { broadcastAlert } from "../alertEvents.js";
import { generateOverlayToken } from "../overlayAuth.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export function createAlertsRouter(): Router {
  const router = Router();

  router.get("/alerts/overlay-token", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    if (!channelSlug) {
      res.status(400).json({ success: false, error: "channelSlug é obrigatório" });
      return;
    }

    const token = generateOverlayToken(channelSlug);
    const overlayBase =
      process.env.WEB_OVERLAY_URL ?? "http://localhost:3000/overlay";
    const overlayUrl = `${overlayBase}/${token}`;

    res.json({
      success: true,
      data: { token, overlayUrl, channelSlug },
    } satisfies ApiResponse);
  });

  router.get("/alerts/config", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    try {
      const configs = await prisma.alertConfig.findMany({
        where: { channelSlug },
        orderBy: { type: "asc" },
      });
      res.json({ success: true, data: configs } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.put("/alerts/config", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const {
      type,
      isActive,
      imageUrl,
      message,
      durationMs,
    } = req.body as {
      type: string;
      isActive?: boolean;
      imageUrl?: string;
      message?: string;
      durationMs?: number;
    };

    if (!type) {
      res.status(400).json({ success: false, error: "type é obrigatório" });
      return;
    }

    try {
      const config = await prisma.alertConfig.upsert({
        where: { channelSlug_type: { channelSlug, type } },
        create: {
          channelSlug,
          type,
          isActive: isActive ?? true,
          imageUrl,
          message,
          durationMs: durationMs ?? 5000,
        },
        update: {
          ...(isActive !== undefined && { isActive }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(message !== undefined && { message }),
          ...(durationMs !== undefined && { durationMs }),
        },
      });

      res.json({ success: true, data: config } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/alerts/test", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const type = (req.body.type as string) || "follow";
    const username = (req.body.username as string) || "viewer";

    try {
      const config = await prisma.alertConfig.findUnique({
        where: { channelSlug_type: { channelSlug, type } },
      });

      if (config && !config.isActive) {
        res.status(400).json({
          success: false,
          error: `Alerta "${type}" está desativado.`,
        });
        return;
      }

      broadcastAlert({
        type,
        channelSlug,
        title: `Teste de alerta: ${type}`,
        message: config?.message ?? `@${username} disparou um evento ${type}!`,
        imageUrl: config?.imageUrl,
        durationMs: config?.durationMs ?? 5000,
        metadata: { username, source: "dashboard-test" },
      });

      res.json({
        success: true,
        message: "Alerta de teste enviado com sucesso",
      } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
