-- Nightfall — player profiles & lifetime stats.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,           -- telegram user id
  name          TEXT    NOT NULL DEFAULT 'Player',
  username      TEXT,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  played        INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,    -- current win streak
  best_streak   INTEGER NOT NULL DEFAULT 0,
  coins         INTEGER NOT NULL DEFAULT 0,    -- soft currency for flair
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen     TEXT
);

-- Finished-game ledger (for leaderboards / history).
CREATE TABLE IF NOT EXISTS results (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  mode      TEXT    NOT NULL,                  -- 'solo' | 'online'
  won       INTEGER NOT NULL,
  team      TEXT    NOT NULL DEFAULT 'town',   -- which side the player was on
  ts        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_results_user ON results(user_id);
