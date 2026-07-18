/**
 * Configuração de moderação por canal — filtros de links, caps, spam e palavras proibidas.
 */

import { Router } from "express";
import { prisma } from "../../infra/prisma/client.js";
import { authMiddleware } from "../auth.js";
import {
  clampTimeoutDurationMinutes,
  invalidateModerationCache,
} from "../../moderation/moderationService.js";
import type { ApiResponse } from "../types.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export function createModerationRouter(): Router {
  const router = Router();

  router.get("/moderation", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    try {
      const config = await prisma.moderationConfig.findUnique({
        where: { channelSlug },
      });

      if (!config) {
        res.json({
          success: true,
          data: {
            channelSlug,
            linksEnabled: false,
            linksWhitelist: [],
            capsEnabled: false,
            capsPercent: 70,
            spamEnabled: false,
            spamWindow: 5,
            bannedWords: [],
            actionType: "warn",
            timeoutDurationMinutes: 1,
          },
        } satisfies ApiResponse);
        return;
      }

      res.json({ success: true, data: config } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.put("/moderation", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const {
      linksEnabled,
      linksWhitelist,
      capsEnabled,
      capsPercent,
      spamEnabled,
      spamWindow,
      bannedWords,
      actionType,
      timeoutDurationMinutes,
    } = req.body as {
      linksEnabled?: boolean;
      linksWhitelist?: string[];
      capsEnabled?: boolean;
      capsPercent?: number;
      spamEnabled?: boolean;
      spamWindow?: number;
      bannedWords?: string[];
      actionType?: string;
      timeoutDurationMinutes?: number;
    };

    if (
      timeoutDurationMinutes !== undefined &&
      (typeof timeoutDurationMinutes !== "number" ||
        !Number.isInteger(timeoutDurationMinutes) ||
        timeoutDurationMinutes < 1 ||
        timeoutDurationMinutes > 10_080)
    ) {
      res.status(400).json({
        success: false,
        error: "timeoutDurationMinutes deve ser um inteiro entre 1 e 10080",
      });
      return;
    }

    const timeoutMinutes =
      timeoutDurationMinutes !== undefined
        ? clampTimeoutDurationMinutes(timeoutDurationMinutes)
        : undefined;

    try {
      const config = await prisma.moderationConfig.upsert({
        where: { channelSlug },
        create: {
          channelSlug,
          linksEnabled: linksEnabled ?? false,
          linksWhitelist: linksWhitelist ?? [],
          capsEnabled: capsEnabled ?? false,
          capsPercent: capsPercent ?? 70,
          spamEnabled: spamEnabled ?? false,
          spamWindow: spamWindow ?? 5,
          bannedWords: bannedWords ?? [],
          actionType: actionType ?? "warn",
          timeoutDurationMinutes: timeoutMinutes ?? 1,
        },
        update: {
          ...(linksEnabled !== undefined && { linksEnabled }),
          ...(linksWhitelist !== undefined && { linksWhitelist }),
          ...(capsEnabled !== undefined && { capsEnabled }),
          ...(capsPercent !== undefined && { capsPercent }),
          ...(spamEnabled !== undefined && { spamEnabled }),
          ...(spamWindow !== undefined && { spamWindow }),
          ...(bannedWords !== undefined && { bannedWords }),
          ...(actionType !== undefined && { actionType }),
          ...(timeoutMinutes !== undefined && {
            timeoutDurationMinutes: timeoutMinutes,
          }),
        },
      });

      invalidateModerationCache(channelSlug);
      res.json({ success: true, data: config } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get("/moderation/logs", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
      const [logs, total] = await Promise.all([
        prisma.moderationLog.findMany({
          where: { channelSlug },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: (page - 1) * limit,
        }),
        prisma.moderationLog.count({ where: { channelSlug } }),
      ]);

      res.json({
        success: true,
        data: {
          logs,
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
