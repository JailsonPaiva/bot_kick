/**
 * CRUD de timers — mensagens agendadas enviadas automaticamente no chat.
 */

import { Router } from "express";
import { prisma } from "../../infra/prisma/client.js";
import { authMiddleware } from "../auth.js";
import { timerService } from "../../timers/timerService.js";
import type { ApiResponse } from "../types.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export function createTimersRouter(): Router {
  const router = Router();

  router.get("/timers", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    try {
      const timers = await prisma.timer.findMany({
        where: { channelSlug },
        orderBy: { createdAt: "asc" },
      });
      res.json({ success: true, data: timers } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/timers", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const { name, messages, intervalMinutes, minViewers } = req.body as {
      name: string;
      messages: string[];
      intervalMinutes?: number;
      minViewers?: number;
    };

    if (!name || !messages?.length) {
      res.status(400).json({ success: false, error: "name e messages são obrigatórios" });
      return;
    }

    try {
      const timer = await prisma.timer.create({
        data: {
          channelSlug,
          name,
          messages,
          intervalMinutes: intervalMinutes ?? 30,
          minViewers: minViewers ?? 0,
        },
      });
      await timerService.reload();
      res.status(201).json({ success: true, data: timer } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.put("/timers/:id", authMiddleware, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, messages, intervalMinutes, minViewers, isActive } = req.body as {
      name?: string;
      messages?: string[];
      intervalMinutes?: number;
      minViewers?: number;
      isActive?: boolean;
    };

    try {
      const timer = await prisma.timer.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(messages !== undefined && { messages }),
          ...(intervalMinutes !== undefined && { intervalMinutes }),
          ...(minViewers !== undefined && { minViewers }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      await timerService.reload();
      res.json({ success: true, data: timer } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.patch("/timers/:id/toggle", authMiddleware, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const current = await prisma.timer.findUnique({ where: { id } });
      if (!current) {
        res.status(404).json({ success: false, error: "Timer não encontrado" });
        return;
      }
      const timer = await prisma.timer.update({
        where: { id },
        data: { isActive: !current.isActive },
      });
      await timerService.reload();
      res.json({ success: true, data: timer } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.delete("/timers/:id", authMiddleware, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      await prisma.timer.delete({ where: { id } });
      await timerService.reload();
      res.json({ success: true, message: "Timer removido" } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
