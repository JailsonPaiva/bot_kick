/**
 * Factory do ecossistema de mini games — engine, cooldown e registry.
 */

import { sendMessage } from "../chat/chatSender.js";
import { GameRepository } from "../db/repositories/gameRepository.js";
import { PlayerRepository } from "../db/repositories/playerRepository.js";
import { demoGame } from "./demo/demoGame.js";
import { createTttGame } from "./ttt/tttCommands.js";
import { CooldownManager } from "./engine/cooldownManager.js";
import { GameManager } from "./engine/gameManager.js";
import { GameRegistry } from "./registry.js";
import type { SendChatFn } from "./types.js";

export interface GameServices {
  gameManager: GameManager;
  cooldown: CooldownManager;
  registry: GameRegistry;
}

export function createGameServices(): GameServices {
  const gameRepository = new GameRepository();
  const playerRepository = new PlayerRepository();
  const sendChat: SendChatFn = (broadcasterId, content) =>
    sendMessage(broadcasterId, content);

  const gameManager = new GameManager(
    gameRepository,
    playerRepository,
    sendChat
  );
  const cooldown = new CooldownManager();
  const registry = new GameRegistry(gameManager, cooldown, sendChat);

  registry.register(demoGame);
  registry.register(createTttGame(playerRepository, gameRepository));

  gameManager.recoverActiveGames();

  return { gameManager, cooldown, registry };
}

export { GameManager } from "./engine/gameManager.js";
export { CooldownManager } from "./engine/cooldownManager.js";
export { GameRegistry } from "./registry.js";
export type { MiniGame, GameHandlerContext, ActiveGameSession } from "./types.js";
