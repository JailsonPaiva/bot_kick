/**
 * Executor de migrations SQL versionadas.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)));

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function getAppliedMigrationIds(db: Database.Database): Set<string> {
  const rows = db
    .prepare("SELECT id FROM schema_migrations")
    .all() as Array<{ id: string }>;

  return new Set(rows.map((row) => row.id));
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export function runMigrations(db: Database.Database): void {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrationIds(db);
  const files = listMigrationFiles();

  for (const file of files) {
    const migrationId = file.replace(/\.sql$/, "");

    if (applied.has(migrationId)) {
      continue;
    }

    const sqlPath = path.join(MIGRATIONS_DIR, file);
    const sql = readFileSync(sqlPath, "utf-8");
    const now = new Date().toISOString();

    logger.info(`Aplicando migration: ${migrationId}`);

    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
        migrationId,
        now
      );
    });

    apply();
    logger.info(`Migration aplicada: ${migrationId}`);
  }
}
