/**
 * Cliente SQLite — conexão singleton, migrations e lifecycle.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { gameConfig } from "../config/gameConfig.js";
import { logger } from "../utils/logger.js";
import { runMigrations } from "./migrations/runner.js";

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = path.resolve(process.cwd(), gameConfig.databasePath);
  mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  logger.info(`Banco SQLite inicializado: ${dbPath}`);
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error("Banco de dados não inicializado. Chame initDatabase() primeiro.");
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info("Conexão SQLite encerrada");
  }
}
