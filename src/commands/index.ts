/**
 * Factory do roteador de comandos com handlers MVP registrados.
 */

import { CommandRouter } from "./router.js";
import { handleAuth, handleEcho, handlePing } from "./handlers/mvpHandlers.js";

export function createCommandRouter(): CommandRouter {
  const router = new CommandRouter();

  router.register("echo", handleEcho);
  router.register("ping", handlePing);
  router.register("auth", handleAuth);

  return router;
}

export { CommandRouter } from "./router.js";
export { parseCommand, isCommand } from "./parser.js";
export type { CommandContext, ParsedCommand, CommandHandler } from "./types.js";
