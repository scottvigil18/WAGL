-- Players table
CREATE TABLE IF NOT EXISTS players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  first_name    TEXT    NOT NULL DEFAULT '',
  last_name     TEXT    NOT NULL DEFAULT '',
  email         TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',
  role          TEXT    NOT NULL DEFAULT 'player' CHECK(role IN ('player', 'admin')),
  archived      INTEGER NOT NULL DEFAULT 0,
  avatar        TEXT    DEFAULT NULL,
  force_password_reset INTEGER NOT NULL DEFAULT 0,
  pending_approval INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  county        TEXT    NOT NULL,
  course_rating REAL    NOT NULL,
  slope_rating  INTEGER NOT NULL,
  holes         INTEGER NOT NULL DEFAULT 18,
  par_front     INTEGER NOT NULL DEFAULT 36,
  par_back      INTEGER NOT NULL DEFAULT 36
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

-- RSVPs table
CREATE TABLE IF NOT EXISTS rsvps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_date  TEXT    NOT NULL,
  course_name TEXT    NOT NULL,
  response    TEXT    NOT NULL CHECK(response IN ('yes', 'no')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(player_id, event_date)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event ON rsvps(event_date);

-- Photos table
CREATE TABLE IF NOT EXISTS photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  filename    TEXT    NOT NULL,
  caption     TEXT    DEFAULT '',
  approved    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT    NOT NULL DEFAULT (datetime('now', '+30 days'))
);

CREATE INDEX IF NOT EXISTS idx_photos_player ON photos(player_id);
CREATE INDEX IF NOT EXISTS idx_photos_expires ON photos(expires_at);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  subject     TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  read        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);

-- Notifications table (admin broadcasts to members)
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  subject     TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  read        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_player ON notifications(player_id, read);

-- Contest Winners table
CREATE TABLE IF NOT EXISTS contest_winners (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date      TEXT    NOT NULL,
  category        TEXT    NOT NULL CHECK(category IN ('mens_closest', 'womens_closest', 'longest_putt', 'handicap_winner')),
  player_id       INTEGER REFERENCES players(id) ON DELETE SET NULL,
  player_name     TEXT    NOT NULL DEFAULT '',
  distance        TEXT    DEFAULT '',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_date, category)
);

CREATE INDEX IF NOT EXISTS idx_contest_winners_date ON contest_winners(event_date);

-- League Settings table
CREATE TABLE IF NOT EXISTS league_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO league_settings (key, value) VALUES ('max_players', '50');
