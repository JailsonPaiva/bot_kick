/**
 * Tipos de entidades persistidas — mapeados do Prisma (camelCase, id UUID string).
 */

export type GameStatus = "active" | "finished" | "abandoned";

export type GameResult = "win" | "loss" | "draw";

export interface PlayerRecord {
  id: string;
  kickUserId: number;
  username: string;
  slug: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
}

export interface GameRecord {
  id: string;
  gameType: string;
  channelSlug: string;
  playerXId: string;
  playerOId: string;
  winnerId: string | null;
  status: GameStatus;
  boardState: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface CreateGameInput {
  id: string;
  gameType: string;
  channelSlug: string;
  playerXId: string;
  playerOId: string;
  boardState?: string;
}

export interface CreatePlayerInput {
  kickUserId: number;
  username: string;
  slug: string;
}
