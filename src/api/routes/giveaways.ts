/**
 * API de sorteios (Fase 4).
 */

import { Router } from "express";
import { authMiddleware } from "../auth.js";
import { giveawayService } from "../../engagement/giveawayService.js";
import type { ApiResponse } from "../types.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export function createGiveawaysRouter(): Router {
  const router = Router();

  router.get("/giveaways", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    try {
      const data = await giveawayService.listRecent(channelSlug);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/giveaways", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const prize = (req.body.prize as string)?.trim();
    const filterType = (req.body.filterType as string) || "everyone";
    const costPoints = Number.parseInt(req.body.costPoints as string, 10) || 0;

    if (!prize) {
      res.status(400).json({ success: false, error: "prize é obrigatório" });
      return;
    }

    try {
      const giveaway = await giveawayService.create(
        channelSlug,
        prize,
        filterType,
        costPoints
      );
      res.status(201).json({ success: true, data: giveaway } satisfies ApiResponse);
    } catch (err) {
      res.status(400).json({ success: false, error: String(err) });
    }
  });

  router.post("/giveaways/draw", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    try {
      const result = await giveawayService.draw(channelSlug);
      if (!result.ok) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, data: result } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/giveaways/reroll", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    try {
      const result = await giveawayService.reroll(channelSlug);
      if (!result.ok) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, data: result } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
