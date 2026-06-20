/**
 * Barrel export do módulo de banco de dados.
 */

export { initDatabase, getDatabase, closeDatabase } from "./client.js";
export { PlayerRepository } from "./repositories/playerRepository.js";
export { GameRepository } from "./repositories/gameRepository.js";
export type {
  PlayerRecord,
  GameRecord,
  GameStatus,
  GameResult,
  CreateGameInput,
  CreatePlayerInput,
} from "./types.js";
