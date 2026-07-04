/**
 * API de enquetes (Fase 4).
 */

import { Router } from "express";
import { authMiddleware } from "../auth.js";
import { pollService } from "../../engagement/pollService.js";
import type { ApiResponse } from "../types.js";
import { serializeBigInts } from "../../utils/serializeBigInt.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export function createPollsRouter(): Router {
  const router = Router();

  router.get("/polls", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    try {
      const data = await pollService.listRecent(channelSlug);
      res.json({ success: true, data: serializeBigInts(data) } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/polls", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const question = (req.body.question as string)?.trim();
    const options = (req.body.options as string[]) ?? [];
    const durationS = Number.parseInt(req.body.durationS as string, 10) || 60;
    const weightedSubs = Boolean(req.body.weightedSubs);

    if (!question || options.length < 2) {
      res.status(400).json({
        success: false,
        error: "question e no mínimo 2 opções são obrigatórios",
      });
      return;
    }

    try {
      const poll = await pollService.create(
        channelSlug,
        question,
        options,
        durationS,
        weightedSubs
      );
      res.status(201).json({
        success: true,
        data: serializeBigInts(poll),
      } satisfies ApiResponse);
    } catch (err) {
      res.status(400).json({ success: false, error: String(err) });
    }
  });

  router.post("/polls/end", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    try {
      const result = await pollService.close(channelSlug);
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
