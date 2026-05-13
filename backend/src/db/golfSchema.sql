-- Players table
CREATE TABLE IF NOT EXISTS players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'player' CHECK(role IN ('player', 'admin')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  county        TEXT    NOT NULL,
  course_rating REAL    NOT NULL,
  slope_rating  INTEGER NOT NULL,
  holes         INTEGER NOT NULL DEFAULT 18
);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL,
  holes       INTEGER NOT NULL DEFAULT 18 CHECK(holes IN (9, 18)),
  course_id   INTEGER REFERENCES courses(id),
  date_played TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(player_id, date_played)
);

-- Handicaps table
CREATE TABLE IF NOT EXISTS handicaps (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id       INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  handicap_index  REAL,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_id);
CREATE INDEX IF NOT EXISTS idx_scores_player_date ON scores(player_id, date_played);
CREATE INDEX IF NOT EXISTS idx_handicaps_player ON handicaps(player_id);
