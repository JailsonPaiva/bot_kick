-- Migration 001: schema inicial (players, games, game_moves)

CREATE TABLE IF NOT EXISTS schema_migrations (
  id         TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kick_user_id  INTEGER NOT NULL UNIQUE,
  username      TEXT NOT NULL,
  slug          TEXT NOT NULL,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  draws         INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id              TEXT PRIMARY KEY,
  game_type       TEXT NOT NULL,
  channel_slug    TEXT NOT NULL,
  player_x_id     INTEGER NOT NULL,
  player_o_id     INTEGER NOT NULL,
  winner_id       INTEGER,
  status          TEXT NOT NULL,
  board_state     TEXT,
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  FOREIGN KEY (player_x_id) REFERENCES players(id),
  FOREIGN KEY (player_o_id) REFERENCES players(id),
  FOREIGN KEY (winner_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_games_channel_status
  ON games(channel_slug, status);

CREATE TABLE IF NOT EXISTS game_moves (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    TEXT NOT NULL,
  player_id  INTEGER NOT NULL,
  position   INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_game_moves_game_id
  ON game_moves(game_id);
