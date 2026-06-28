/**
 * Rotas de consulta do sistema de loyalty points.
 */

import { Router } from "express";
import { prisma } from "../../infra/prisma/client.js";
import { authMiddleware } from "../auth.js";
import type { ApiResponse } from "../types.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export function createLoyaltyRouter(): Router {
  const router = Router();

  router.get("/loyalty/top", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    const limit = Number.parseInt(req.query.limit as string, 10) || 20;

    try {
      const top = await prisma.viewerPoints.findMany({
        where: { channelSlug },
        orderBy: [{ balance: "desc" }, { updatedAt: "asc" }],
        take: Math.min(Math.max(limit, 1), 100),
      });
      res.json({ success: true, data: top } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get("/loyalty/transactions", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    const page = Number.parseInt(req.query.page as string, 10) || 1;
    const limit = Number.parseInt(req.query.limit as string, 10) || 50;

    try {
      const [transactions, total] = await Promise.all([
        prisma.pointTransaction.findMany({
          where: { channelSlug },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: (page - 1) * limit,
        }),
        prisma.pointTransaction.count({ where: { channelSlug } }),
      ]);

      res.json({
        success: true,
        data: {
          transactions,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
