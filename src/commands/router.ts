/**
 * Roteador de comandos — despacha mensagens parseadas para handlers registrados.
 * Se nenhum handler estático bater, tenta comandos customizáveis do banco de dados.
 */

import type { ChatMessage } from "../chat/types.js";
import { logger } from "../utils/logger.js";
import { parseCommand } from "./parser.js";
import { isSystemCommandActive } from "./systemCommandConfigService.js";
import { isKnownSystemCommand } from "./systemCommandsCatalog.js";
import type { CommandContext, CommandHandler, ParsedCommand } from "./types.js";
import { tryExecuteCustomCommand } from "./customCommands.js";
import {
  giveawayService,
  normalizeEntryCommand,
  normalizeEntryMode,
} from "../engagement/giveawayService.js";
import { handleGiveawayEntry } from "./handlers/engagementHandlers.js";

export class CommandRouter {
  private handlers = new Map<string, CommandHandler>();

  register(command: string, handler: CommandHandler): void {
    this.handlers.set(command.toLowerCase(), handler);
  }

  getRegisteredCommands(): string[] {
    return [...this.handlers.keys()];
  }

  async dispatch(message: ChatMessage, ctx: CommandContext): Promise<void> {
    const content = message.content.trim();

    if (message.sender.slug.toLowerCase() === ctx.botSlug.toLowerCase()) {
      return;
    }

    const parsed = parseCommand(content);
    if (!parsed) {
      return;
    }

    logger.info(`[CHAT] ${message.sender.username}: ${content}`);

    // Comando de entrada customizado do sorteio ativo (!join, etc.)
    const openGiveaway = await giveawayService.getOpen(ctx.channelSlug);
    if (
      openGiveaway &&
      normalizeEntryMode(openGiveaway.entryMode) === "command" &&
      parsed.command === normalizeEntryCommand(openGiveaway.entryCommand) &&
      !this.handlers.has(parsed.command)
    ) {
      try {
        await handleGiveawayEntry(parsed, ctx);
      } catch (err) {
        logger.error(`Erro ao processar entrada do sorteio "${content}"`, err);
      }
      return;
    }

    const handler = this.handlers.get(parsed.command);
    if (handler) {
      if (isKnownSystemCommand(parsed.command)) {
        const active = await isSystemCommandActive(ctx.channelSlug, parsed.command);
        if (!active) {
          logger.info(`[CHAT] Comando !${parsed.command} desativado — ignorado`);
          return;
        }
      }

      try {
        await handler(parsed, ctx);
      } catch (err) {
        logger.error(`Erro ao processar comando "${content}"`, err);
      }
      return;
    }

    // Fallback: comandos customizáveis no banco
    try {
      await tryExecuteCustomCommand(
        parsed.command,
        ctx.channelSlug,
        message,
        ctx.broadcasterId
      );
    } catch (err) {
      logger.error(`Erro ao processar comando customizado "!${parsed.command}"`, err);
    }
  }
}

export type { ParsedCommand, CommandContext, CommandHandler };
