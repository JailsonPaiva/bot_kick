/**
 * Factory do roteador de comandos com handlers MVP e mini games registrados.
 */

import type { PlayerRepository } from "../db/repositories/playerRepository.js";
import type { GameRegistry } from "../games/registry.js";
import { createRankHandler } from "../rank/rankHandler.js";
import type { LoyaltyService } from "../loyalty/loyaltyService.js";
import {
  createPointsHandler,
  createTopHandler,
  createTransferHandler,
} from "../loyalty/loyaltyHandlers.js";
import { CommandRouter } from "./router.js";
import { handleAuth, handleEcho, handlePing } from "./handlers/mvpHandlers.js";

export function createCommandRouter(
  gameRegistry?: GameRegistry,
  playerRepository?: PlayerRepository,
  loyalty?: LoyaltyService
): CommandRouter {
  const router = new CommandRouter();

  router.register("echo", handleEcho);
  router.register("ping", handlePing);
  router.register("auth", handleAuth);

  if (playerRepository) {
    router.register("rank", createRankHandler(playerRepository));
  }
  if (loyalty) {
    router.register("pontos", createPointsHandler(loyalty));
    router.register("top", createTopHandler(loyalty));
    router.register("dar", createTransferHandler(loyalty));
  }

  if (gameRegistry) {
    gameRegistry.attachToRouter(router);
  }

  return router;
}

export { CommandRouter } from "./router.js";
export { parseCommand, isCommand } from "./parser.js";
export type { CommandContext, ParsedCommand, CommandHandler } from "./types.js";
