/**
 * Tipos de entidades persistidas no SQLite.
 */

export type GameStatus = "active" | "finished" | "abandoned";

export type GameResult = "win" | "loss" | "draw";

export interface PlayerRecord {
  id: number;
  kick_user_id: number;
  username: string;
  slug: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface GameRecord {
  id: string;
  game_type: string;
  channel_slug: string;
  player_x_id: number;
  player_o_id: number;
  winner_id: number | null;
  status: GameStatus;
  board_state: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface CreateGameInput {
  id: string;
  game_type: string;
  channel_slug: string;
  player_x_id: number;
  player_o_id: number;
  board_state?: string;
}

export interface CreatePlayerInput {
  kick_user_id: number;
  username: string;
  slug: string;
}
