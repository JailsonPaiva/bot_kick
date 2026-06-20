/**
 * Repository de partidas — criação, consulta e finalização de jogos.
 */

import type Database from "better-sqlite3";
import { getDatabase } from "../client.js";
import type { CreateGameInput, GameRecord, GameStatus } from "../types.js";

export class GameRepository {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database ?? getDatabase();
  }

  create(input: CreateGameInput): GameRecord {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO games (
           id, game_type, channel_slug, player_x_id, player_o_id,
           status, board_state, started_at
         ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
      )
      .run(
        input.id,
        input.game_type,
        input.channel_slug,
        input.player_x_id,
        input.player_o_id,
        input.board_state ?? null,
        now
      );

    return this.findById(input.id)!;
  }

  findById(id: string): GameRecord | null {
    const row = this.db
      .prepare("SELECT * FROM games WHERE id = ?")
      .get(id) as GameRecord | undefined;

    return row ?? null;
  }

  findActiveByChannel(channelSlug: string): GameRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM games
         WHERE channel_slug = ? AND status = 'active'
         ORDER BY started_at DESC
         LIMIT 1`
      )
      .get(channelSlug) as GameRecord | undefined;

    return row ?? null;
  }

  finish(
    gameId: string,
    winnerId: number | null,
    boardState: string
  ): GameRecord {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE games
         SET status = 'finished',
             winner_id = ?,
             board_state = ?,
             finished_at = ?
         WHERE id = ?`
      )
      .run(winnerId, boardState, now, gameId);

    return this.findById(gameId)!;
  }

  abandon(gameId: string, boardState?: string): GameRecord {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE games
         SET status = 'abandoned',
             board_state = COALESCE(?, board_state),
             finished_at = ?
         WHERE id = ?`
      )
      .run(boardState ?? null, now, gameId);

    return this.findById(gameId)!;
  }

  updateStatus(gameId: string, status: GameStatus): GameRecord {
    this.db
      .prepare("UPDATE games SET status = ? WHERE id = ?")
      .run(status, gameId);

    return this.findById(gameId)!;
  }

  recordMove(gameId: string, playerId: number, position: number): void {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO game_moves (game_id, player_id, position, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(gameId, playerId, position, now);
  }
}
