/**
 * CRUD de comandos customizáveis por canal.
 */

import { Router } from "express";
import { prisma } from "../../infra/prisma/client.js";
import {
  listSystemCommands,
  toggleSystemCommand,
  updateSystemCommand,
} from "../../commands/systemCommandConfigService.js";
import { getSystemCommandDefinition } from "../../commands/systemCommandsCatalog.js";
import { authMiddleware } from "../auth.js";
import type { ApiResponse } from "../types.js";

const DEFAULT_CHANNEL = process.env.KICK_CHANNEL_SLUG ?? "";

export function createCommandsRouter(): Router {
  const router = Router();

  router.get("/commands", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    try {
      const commands = await prisma.command.findMany({
        where: { channelSlug },
        orderBy: { trigger: "asc" },
      });
      res.json({ success: true, data: commands } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.post("/commands", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const { trigger, response, aliases, permission, cooldown } = req.body as {
      trigger: string;
      response: string;
      aliases?: string[];
      permission?: string;
      cooldown?: number;
    };

    if (!trigger || !response) {
      res.status(400).json({ success: false, error: "trigger e response são obrigatórios" });
      return;
    }

    try {
      const command = await prisma.command.create({
        data: {
          channelSlug,
          trigger: trigger.toLowerCase().replace(/^!/, ""),
          response,
          aliases: (aliases ?? []).map((a) => a.toLowerCase().replace(/^!/, "")),
          permission: permission ?? "everyone",
          cooldown: cooldown ?? 5,
        },
      });
      res.status(201).json({ success: true, data: command } satisfies ApiResponse);
    } catch (err) {
      const message = String(err);
      if (message.includes("Unique constraint")) {
        res.status(409).json({ success: false, error: "Trigger já existe neste canal" });
        return;
      }
      res.status(500).json({ success: false, error: message });
    }
  });

  router.put("/commands/:id", authMiddleware, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { response, aliases, permission, cooldown, isActive } = req.body as {
      response?: string;
      aliases?: string[];
      permission?: string;
      cooldown?: number;
      isActive?: boolean;
    };

    try {
      const command = await prisma.command.update({
        where: { id },
        data: {
          ...(response !== undefined && { response }),
          ...(aliases !== undefined && {
            aliases: aliases.map((a) => a.toLowerCase().replace(/^!/, "")),
          }),
          ...(permission !== undefined && { permission }),
          ...(cooldown !== undefined && { cooldown }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      res.json({ success: true, data: command } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.patch("/commands/:id/toggle", authMiddleware, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const current = await prisma.command.findUnique({ where: { id } });
      if (!current) {
        res.status(404).json({ success: false, error: "Comando não encontrado" });
        return;
      }
      const command = await prisma.command.update({
        where: { id },
        data: { isActive: !current.isActive },
      });
      res.json({ success: true, data: command } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.delete("/commands/:id", authMiddleware, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      await prisma.command.delete({ where: { id } });
      res.json({ success: true, message: "Comando removido" } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.get("/commands/system", authMiddleware, async (req, res) => {
    const channelSlug = (req.query.channel as string) || DEFAULT_CHANNEL;
    try {
      const commands = await listSystemCommands(channelSlug);
      res.json({ success: true, data: commands } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.put("/commands/system/:trigger", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const trigger = Array.isArray(req.params.trigger)
      ? req.params.trigger[0]
      : req.params.trigger;
    const { response, isActive } = req.body as {
      response?: string;
      isActive?: boolean;
    };

    if (!getSystemCommandDefinition(trigger)) {
      res.status(404).json({ success: false, error: "Comando padrão não encontrado" });
      return;
    }

    try {
      const command = await updateSystemCommand(channelSlug, trigger, {
        ...(response !== undefined && { response }),
        ...(isActive !== undefined && { isActive }),
      });
      res.json({ success: true, data: command } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  router.patch("/commands/system/:trigger/toggle", authMiddleware, async (req, res) => {
    const channelSlug = (req.body.channelSlug as string) || DEFAULT_CHANNEL;
    const trigger = Array.isArray(req.params.trigger)
      ? req.params.trigger[0]
      : req.params.trigger;

    if (!getSystemCommandDefinition(trigger)) {
      res.status(404).json({ success: false, error: "Comando padrão não encontrado" });
      return;
    }

    try {
      const command = await toggleSystemCommand(channelSlug, trigger);
      res.json({ success: true, data: command } satisfies ApiResponse);
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  return router;
}
