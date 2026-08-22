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
const VALID_ACTION_TYPES = new Set(["warn", "delete", "timeout"]);

function parseTimeoutField(name: string, value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 10_080
  ) {
    throw new Error(`${name} deve ser um inteiro entre 1 e 10080`);
  }
  return clampTimeoutDurationMinutes(value);
}

function parseActionField(name: string, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !VALID_ACTION_TYPES.has(value)) {
    throw new Error(`${name} deve ser um de: warn, delete, timeout`);
  }
  return value;
}

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
            linksActionType: "warn",
            linksTimeoutDurationMinutes: 1,
            capsEnabled: false,
            capsPercent: 70,
            capsActionType: "warn",
            capsTimeoutDurationMinutes: 1,
            spamEnabled: false,
            spamWindow: 5,
            spamActionType: "warn",
            spamTimeoutDurationMinutes: 1,
            bannedWords: [],
            bannedActionType: "warn",
            bannedTimeoutDurationMinutes: 1,
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
      linksActionType,
      linksTimeoutDurationMinutes,
      capsEnabled,
      capsPercent,
      capsActionType,
      capsTimeoutDurationMinutes,
      spamEnabled,
      spamWindow,
      spamActionType,
      spamTimeoutDurationMinutes,
      bannedWords,
      bannedActionType,
      bannedTimeoutDurationMinutes,
      actionType,
      timeoutDurationMinutes,
    } = req.body as {
      linksEnabled?: boolean;
      linksWhitelist?: string[];
      linksActionType?: string;
      linksTimeoutDurationMinutes?: number;
      capsEnabled?: boolean;
      capsPercent?: number;
      capsActionType?: string;
      capsTimeoutDurationMinutes?: number;
      spamEnabled?: boolean;
      spamWindow?: number;
      spamActionType?: string;
      spamTimeoutDurationMinutes?: number;
      bannedWords?: string[];
      bannedActionType?: string;
      bannedTimeoutDurationMinutes?: number;
      actionType?: string;
      timeoutDurationMinutes?: number;
    };

    let timeoutMinutes: number | undefined;
    let linksTimeoutMinutes: number | undefined;
    let capsTimeoutMinutes: number | undefined;
    let spamTimeoutMinutes: number | undefined;
    let bannedTimeoutMinutes: number | undefined;
    let globalAction: string | undefined;
    let linksAction: string | undefined;
    let capsAction: string | undefined;
    let spamAction: string | undefined;
    let bannedAction: string | undefined;

    try {
      timeoutMinutes = parseTimeoutField(
        "timeoutDurationMinutes",
        timeoutDurationMinutes
      );
      linksTimeoutMinutes = parseTimeoutField(
        "linksTimeoutDurationMinutes",
        linksTimeoutDurationMinutes
      );
      capsTimeoutMinutes = parseTimeoutField(
        "capsTimeoutDurationMinutes",
        capsTimeoutDurationMinutes
      );
      spamTimeoutMinutes = parseTimeoutField(
        "spamTimeoutDurationMinutes",
        spamTimeoutDurationMinutes
      );
      bannedTimeoutMinutes = parseTimeoutField(
        "bannedTimeoutDurationMinutes",
        bannedTimeoutDurationMinutes
      );
      globalAction = parseActionField("actionType", actionType);
      linksAction = parseActionField("linksActionType", linksActionType);
      capsAction = parseActionField("capsActionType", capsActionType);
      spamAction = parseActionField("spamActionType", spamActionType);
      bannedAction = parseActionField("bannedActionType", bannedActionType);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Payload inválido",
      });
      return;
    }

    try {
      const createAction = globalAction ?? "warn";
      const createTimeout = timeoutMinutes ?? 1;
      const config = await prisma.moderationConfig.upsert({
        where: { channelSlug },
        create: {
          channelSlug,
          linksEnabled: linksEnabled ?? false,
          linksWhitelist: linksWhitelist ?? [],
          linksActionType: linksAction ?? createAction,
          linksTimeoutDurationMinutes: linksTimeoutMinutes ?? createTimeout,
          capsEnabled: capsEnabled ?? false,
          capsPercent: capsPercent ?? 70,
          capsActionType: capsAction ?? createAction,
          capsTimeoutDurationMinutes: capsTimeoutMinutes ?? createTimeout,
          spamEnabled: spamEnabled ?? false,
          spamWindow: spamWindow ?? 5,
          spamActionType: spamAction ?? createAction,
          spamTimeoutDurationMinutes: spamTimeoutMinutes ?? createTimeout,
          bannedWords: bannedWords ?? [],
          bannedActionType: bannedAction ?? createAction,
          bannedTimeoutDurationMinutes: bannedTimeoutMinutes ?? createTimeout,
          actionType: createAction,
          timeoutDurationMinutes: createTimeout,
        },
        update: {
          ...(linksEnabled !== undefined && { linksEnabled }),
          ...(linksWhitelist !== undefined && { linksWhitelist }),
          ...(linksAction !== undefined && { linksActionType: linksAction }),
          ...(linksTimeoutMinutes !== undefined && {
            linksTimeoutDurationMinutes: linksTimeoutMinutes,
          }),
          ...(capsEnabled !== undefined && { capsEnabled }),
          ...(capsPercent !== undefined && { capsPercent }),
          ...(capsAction !== undefined && { capsActionType: capsAction }),
          ...(capsTimeoutMinutes !== undefined && {
            capsTimeoutDurationMinutes: capsTimeoutMinutes,
          }),
          ...(spamEnabled !== undefined && { spamEnabled }),
          ...(spamWindow !== undefined && { spamWindow }),
          ...(spamAction !== undefined && { spamActionType: spamAction }),
          ...(spamTimeoutMinutes !== undefined && {
            spamTimeoutDurationMinutes: spamTimeoutMinutes,
          }),
          ...(bannedWords !== undefined && { bannedWords }),
          ...(bannedAction !== undefined && { bannedActionType: bannedAction }),
          ...(bannedTimeoutMinutes !== undefined && {
            bannedTimeoutDurationMinutes: bannedTimeoutMinutes,
          }),
          ...(globalAction !== undefined && { actionType: globalAction }),
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
