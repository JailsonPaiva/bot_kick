/**
 * Registro de mini games e integração com o roteador de comandos.
 */

import type { CommandRouter } from "../commands/router.js";
import type { CommandContext, ParsedCommand } from "../commands/types.js";
import { logger } from "../utils/logger.js";
import type { CooldownManager } from "./engine/cooldownManager.js";
import type { GameManager } from "./engine/gameManager.js";
import type { GameHandlerContext, MiniGame, SendChatFn } from "./types.js";

export class GameRegistry {
  private games = new Map<string, MiniGame>();
  private gameManager: GameManager;
  private cooldown: CooldownManager;
  private sendChat: SendChatFn;

  constructor(
    gameManager: GameManager,
    cooldown: CooldownManager,
    sendChat: SendChatFn
  ) {
    this.gameManager = gameManager;
    this.cooldown = cooldown;
    this.sendChat = sendChat;
  }

  register(game: MiniGame): void {
    this.games.set(game.commandPrefix.toLowerCase(), game);
    logger.info(`Mini game registrado: ${game.name} (!${game.commandPrefix})`);
  }

  getRegisteredPrefixes(): string[] {
    return [...this.games.keys()];
  }

  attachToRouter(router: CommandRouter): void {
    for (const game of this.games.values()) {
      router.register(game.commandPrefix, async (parsed: ParsedCommand, command: CommandContext) => {
        const userId = command.message.sender.id;

        if (!this.cooldown.tryConsume(userId, game.commandPrefix)) {
          const waitMs = this.cooldown.remainingMs(userId, game.commandPrefix);
          const waitSec = Math.ceil(waitMs / 1000);
          await this.sendChat(
            command.broadcasterId,
            `@${command.message.sender.username} aguarde ${waitSec}s antes de usar !${game.commandPrefix} novamente.`
          );
          return;
        }

        const ctx: GameHandlerContext = {
          parsed,
          command,
          gameManager: this.gameManager,
          cooldown: this.cooldown,
          sendChat: this.sendChat,
        };

        await game.handle(ctx);
      });
    }
  }
}
