/**
 * Repository de jogadores — CRUD e estatísticas de ranking.
 */

import type Database from "better-sqlite3";
import { getDatabase } from "../client.js";
import type { CreatePlayerInput, GameResult, PlayerRecord } from "../types.js";

const POINTS: Record<GameResult, number> = {
  win: 3,
  loss: 0,
  draw: 1,
};

function mapPlayerRow(row: PlayerRecord): PlayerRecord {
  return row;
}

export class PlayerRepository {
  private db: Database.Database;

  constructor(database?: Database.Database) {
    this.db = database ?? getDatabase();
  }

  findByKickUserId(kickUserId: number): PlayerRecord | null {
    const row = this.db
      .prepare("SELECT * FROM players WHERE kick_user_id = ?")
      .get(kickUserId) as PlayerRecord | undefined;

    return row ? mapPlayerRow(row) : null;
  }

  findById(id: number): PlayerRecord | null {
    const row = this.db
      .prepare("SELECT * FROM players WHERE id = ?")
      .get(id) as PlayerRecord | undefined;

    return row ? mapPlayerRow(row) : null;
  }

  findOrCreate(input: CreatePlayerInput): PlayerRecord {
    const existing = this.findByKickUserId(input.kick_user_id);
    if (existing) {
      if (
        existing.username !== input.username ||
        existing.slug !== input.slug
      ) {
        const now = new Date().toISOString();
        this.db
          .prepare(
            `UPDATE players
             SET username = ?, slug = ?, updated_at = ?
             WHERE id = ?`
          )
          .run(input.username, input.slug, now, existing.id);

        return this.findById(existing.id)!;
      }
      return existing;
    }

    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO players (
           kick_user_id, username, slug, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(input.kick_user_id, input.username, input.slug, now, now);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  updateStats(playerId: number, result: GameResult): PlayerRecord {
    const column =
      result === "win" ? "wins" : result === "loss" ? "losses" : "draws";
    const pointsDelta = POINTS[result];
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE players
         SET ${column} = ${column} + 1,
             points = points + ?,
             updated_at = ?
         WHERE id = ?`
      )
      .run(pointsDelta, now, playerId);

    return this.findById(playerId)!;
  }

  getTopN(limit: number): PlayerRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM players
         ORDER BY points DESC, wins DESC, id ASC
         LIMIT ?`
      )
      .all(limit) as PlayerRecord[];

    return rows.map(mapPlayerRow);
  }
}
