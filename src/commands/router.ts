/**
 * Roteador de comandos — despacha mensagens parseadas para handlers registrados.
 */

import type { ChatMessage } from "../chat/types.js";
import { logger } from "../utils/logger.js";
import { parseCommand } from "./parser.js";
import type { CommandContext, CommandHandler, ParsedCommand } from "./types.js";

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

    const handler = this.handlers.get(parsed.command);
    if (!handler) {
      return;
    }

    try {
      await handler(parsed, ctx);
    } catch (err) {
      logger.error(`Erro ao processar comando "${content}"`, err);
    }
  }
}

export type { ParsedCommand, CommandContext, CommandHandler };
