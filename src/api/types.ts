/**
 * Tipos para a API REST do dashboard.
 */

import type { Request } from "express";
import type { PlayerTokenPayload } from "./playerAuth.js";

export interface AuthRequest extends Request {
  userId?: string;
  player?: PlayerTokenPayload;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BotStatusResponse {
  online: boolean;
  uptime: number;
  activeGames: number;
  totalPlayers: number;
  version: string;
}

export interface GameHistoryItem {
  id: string;
  gameType: string;
  channelSlug: string;
  playerXUsername: string;
  playerOUsername: string;
  winnerUsername: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface PlayerRankingItem {
  id: number;
  kickUserId: number;
  username: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  rank: number;
}

export interface ConfigUpdate {
  gameTimeoutMs?: number;
  commandCooldownMs?: number;
  maxActiveGames?: number;
  botMessagePrefix?: boolean;
  recoverGamesOnBoot?: boolean;
}
