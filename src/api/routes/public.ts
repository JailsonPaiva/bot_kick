/**
 * Endpoints públicos (sem autenticação) para ranking.
 */

import { Router } from "express";
import { prisma } from "../../infra/prisma/client.js";
import type { ApiResponse } from "../types.js";
import {
  mapGroupedPointsToRankingEntry,
  mapViewerPointsToRankingEntry,
} from "../publicRanking.js";

type Period = "week" | "month" | "all";

function sinceDate(period: Period): Date | null {
  const now = new Date();
  if (period === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "month") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

export function createPublicRouter(): Router {
  const router = Router();

  router.get("/public/ranking/:channelSlug", async (req, res) => {
    const channelSlug = Array.isArray(req.params.channelSlug)
      ? req.params.channelSlug[0]
      : req.params.channelSlug;
    const periodRaw = (req.query.period as string) ?? "all";
    const period = (["week", "month", "all"].includes(periodRaw)
      ? periodRaw
      : "all") as Period;
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit as string, 10) || 20, 1),
      100
    );

    try {
      if (period === "all") {
        const rows = await prisma.viewerPoints.findMany({
          where: { channelSlug },
          orderBy: [{ balance: "desc" }, { updatedAt: "asc" }],
          take: limit,
        });
        const ranking = rows.map(mapViewerPointsToRankingEntry);
        res.json({ success: true, data: { period, ranking } } satisfies ApiResponse);
        return;
      }

      const since = sinceDate(period)!;
      const grouped = await prisma.pointTransaction.groupBy({
        by: ["kickUserId"],
        where: { channelSlug, createdAt: { gte: since } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: limit,
      });

      const ids = grouped.map((g) => g.kickUserId);
      const viewers = await prisma.viewerPoints.findMany({
        where: { channelSlug, kickUserId: { in: ids } },
      });
      const map = new Map(viewers.map((v) => [v.kickUserId.toString(), v]));

      const ranking = grouped.map((g) =>
        mapGroupedPointsToRankingEntry(
          g.kickUserId,
          g._sum.amount ?? 0,
          map.get(g.kickUserId.toString())
        )
      );

      res.json({ success: true, data: { period, ranking } } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
