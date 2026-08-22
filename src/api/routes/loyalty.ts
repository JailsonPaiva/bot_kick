/**
 * Rotas do sistema de loyalty points (consulta + configuração).
 */

import { Router } from "express";
import { prisma } from "../../infra/prisma/client.js";
import { authMiddleware } from "../auth.js";
import type { ApiResponse } from "../types.js";
import { serializeBigInts } from "../../utils/serializeBigInt.js";
import {
  loyaltyService,
  type LoyaltyConfigUpdate,
} from "../../loyalty/loyaltyService.js";
import { storeService } from "../../loyalty/storeService.js";
import {
  isLoyaltyEventType,
  type LoyaltyEventType,
} from "../../loyalty/loyaltyConfig.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

function slugFromUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "viewer";
}

export function createLoyaltyRouter(): Router {
  const router = Router();

  router.get("/loyalty/config", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    if (!channelSlug) {
      res.status(400).json({ success: false, error: "channelSlug é obrigatório" });
      return;
    }

    try {
      const config = await loyaltyService.getOrCreateConfig(channelSlug);
      res.json({ success: true, data: config } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.put("/loyalty/config", authMiddleware, async (req, res) => {
    const channelSlug =
      (req.body.channelSlug as string) ||
      (req.query.channel as string) ||
      DEFAULT_CHANNEL;

    if (!channelSlug) {
      res.status(400).json({ success: false, error: "channelSlug é obrigatório" });
      return;
    }

    const update = req.body as LoyaltyConfigUpdate & { channelSlug?: string };
    const { channelSlug: _ignored, ...fields } = update;

    try {
      const result = await loyaltyService.updateConfig(channelSlug, fields);
      if (!result.ok) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, data: result.data } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/loyalty/test-event", authMiddleware, async (req, res) => {
    const channelSlug =
      (req.body.channelSlug as string) ||
      (req.query.channel as string) ||
      DEFAULT_CHANNEL;
    const eventTypeRaw = (req.body.eventType as string) || "follow";
    const username = ((req.body.username as string) || "viewer").trim() || "viewer";

    if (!channelSlug) {
      res.status(400).json({ success: false, error: "channelSlug é obrigatório" });
      return;
    }

    if (!isLoyaltyEventType(eventTypeRaw)) {
      res.status(400).json({
        success: false,
        error: "eventType inválido (follow | subscription | gift_sub | raid)",
      });
      return;
    }

    const eventType: LoyaltyEventType = eventTypeRaw;

    try {
      const result = await loyaltyService.awardForEvent(
        channelSlug,
        {
          kickUserId: 0,
          username,
          slug: slugFromUsername(username),
        },
        eventType
      );

      res.json({
        success: true,
        data: {
          eventType,
          username,
          awarded: result.awarded,
          channelSlug,
        },
      } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get("/loyalty/top", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    const limit = Number.parseInt(req.query.limit as string, 10) || 20;

    try {
      const top = await prisma.viewerPoints.findMany({
        where: { channelSlug },
        orderBy: [{ balance: "desc" }, { updatedAt: "asc" }],
        take: Math.min(Math.max(limit, 1), 100),
      });
      res.json({ success: true, data: serializeBigInts(top) } satisfies ApiResponse);
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

      res.json(
        serializeBigInts({
          success: true,
          data: {
            transactions,
            total,
            page,
            totalPages: Math.ceil(total / limit),
          },
        }) satisfies ApiResponse
      );
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get("/loyalty/store/items", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    const includeInactive = String(req.query.includeInactive ?? "false") === "true";
    try {
      const items = await storeService.listItems(channelSlug, includeInactive);
      res.json({ success: true, data: items } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/loyalty/store/items", authMiddleware, async (req, res) => {
    const channelSlug =
      (req.body.channelSlug as string) ||
      (req.query.channel as string) ||
      DEFAULT_CHANNEL;
    try {
      const item = await storeService.createItem(channelSlug, req.body);
      res.status(201).json({ success: true, data: item } satisfies ApiResponse);
    } catch (err) {
      res.status(400).json({ success: false, error: String(err) });
    }
  });

  router.put("/loyalty/store/items/:id", authMiddleware, async (req, res) => {
    const channelSlug =
      (req.body.channelSlug as string) ||
      (req.query.channel as string) ||
      DEFAULT_CHANNEL;
    const itemId = String(req.params.id);
    try {
      const item = await storeService.updateItem(channelSlug, itemId, req.body);
      res.json({ success: true, data: item } satisfies ApiResponse);
    } catch (err) {
      res.status(400).json({ success: false, error: String(err) });
    }
  });

  router.delete("/loyalty/store/items/:id", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    const itemId = String(req.params.id);
    try {
      const item = await storeService.deactivateItem(channelSlug, itemId);
      res.json({ success: true, data: item } satisfies ApiResponse);
    } catch (err) {
      res.status(400).json({ success: false, error: String(err) });
    }
  });

  router.get("/loyalty/store/redemptions", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    const page = Number.parseInt(req.query.page as string, 10) || 1;
    const limit = Number.parseInt(req.query.limit as string, 10) || 20;
    try {
      const data = await storeService.listRedemptions(channelSlug, page, limit);
      res.json(serializeBigInts({ success: true, data } satisfies ApiResponse));
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
