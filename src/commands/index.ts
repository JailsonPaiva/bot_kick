/**
 * Factory do roteador de comandos com handlers MVP e mini games registrados.
 */

import type { GameRegistry } from "../games/registry.js";
import { CommandRouter } from "./router.js";
import { handleAuth, handleEcho, handlePing } from "./handlers/mvpHandlers.js";

export function createCommandRouter(gameRegistry?: GameRegistry): CommandRouter {
  const router = new CommandRouter();

  router.register("echo", handleEcho);
  router.register("ping", handlePing);
  router.register("auth", handleAuth);

  if (gameRegistry) {
    gameRegistry.attachToRouter(router);
  }

  return router;
}

export { CommandRouter } from "./router.js";
export { parseCommand, isCommand } from "./parser.js";
export type { CommandContext, ParsedCommand, CommandHandler } from "./types.js";
