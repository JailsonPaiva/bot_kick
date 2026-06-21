/**
 * Exportações principais da API.
 */

export { startApiServer } from "./server.js";
export { generateToken, verifyToken, hashPassword, authMiddleware } from "./auth.js";
export type {
  ApiResponse,
  BotStatusResponse,
  GameHistoryItem,
  PlayerRankingItem,
  ConfigUpdate,
  AuthRequest,
} from "./types.js";
