/**
 * Helpers para testes com SQLite in-memory.
 */

import Database from "better-sqlite3";
import { runMigrations } from "./migrations/runner.js";

export function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
