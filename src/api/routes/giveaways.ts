/**
 * API de sorteios (Fase 4).
 */

import { Router } from "express";
import { authMiddleware } from "../auth.js";
import {
  giveawayService,
  normalizeEntryMode,
} from "../../engagement/giveawayService.js";
import type { ApiResponse } from "../types.js";
import { serializeBigInts } from "../../utils/serializeBigInt.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export function createGiveawaysRouter(): Router {
  const router = Router();

  router.get("/giveaways", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    try {
      const data = await giveawayService.listRecent(channelSlug);
      res.json({ success: true, data: serializeBigInts(data) } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/giveaways", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const prize = (req.body.prize as string)?.trim();
    const filterType = (req.body.filterType as string) || "everyone";
    const costPoints = Number.parseInt(String(req.body.costPoints ?? "0"), 10) || 0;
    const weightedSubs = Boolean(req.body.weightedSubs);
    const entryMode = normalizeEntryMode(req.body.entryMode);
    const entryCommand = req.body.entryCommand as string | undefined;
    const entryDurationSeconds =
      req.body.entryDurationSeconds !== undefined
        ? Number.parseInt(String(req.body.entryDurationSeconds), 10)
        : undefined;

    if (!prize) {
      res.status(400).json({ success: false, error: "prize é obrigatório" });
      return;
    }

    if (
      entryMode === "chat" &&
      entryDurationSeconds !== undefined &&
      (!Number.isInteger(entryDurationSeconds) ||
        entryDurationSeconds < 15 ||
        entryDurationSeconds > 3600)
    ) {
      res.status(400).json({
        success: false,
        error: "entryDurationSeconds deve ser um inteiro entre 15 e 3600",
      });
      return;
    }

    try {
      const giveaway = await giveawayService.create(channelSlug, {
        prize,
        filterType,
        costPoints,
        weightedSubs,
        entryMode,
        entryCommand,
        entryDurationSeconds,
      });
      res.status(201).json({
        success: true,
        data: serializeBigInts(giveaway),
      } satisfies ApiResponse);
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
      res.json({ success: true, data: serializeBigInts(result) } satisfies ApiResponse);
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
      res.json({ success: true, data: serializeBigInts(result) } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
