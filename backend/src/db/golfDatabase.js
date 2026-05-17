const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/golf_league.db');
const SCHEMA_PATH = path.join(__dirname, 'golfSchema.sql');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const golfDb = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
golfDb.pragma('journal_mode = WAL');
golfDb.pragma('foreign_keys = ON');

// Run schema on startup
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
golfDb.exec(schema);

// Migration: add holes column if it doesn't exist
const columns = golfDb.prepare("PRAGMA table_info(scores)").all();
const hasHoles = columns.some(col => col.name === 'holes');
if (!hasHoles) {
  golfDb.exec("ALTER TABLE scores ADD COLUMN holes INTEGER NOT NULL DEFAULT 18 CHECK(holes IN (9, 18))");
}

// Migration: remove CHECK(score BETWEEN 50 AND 150) constraint by rebuilding the table
const tableInfo = golfDb.prepare("SELECT sql FROM sqlite_master WHERE name = 'scores'").get();
if (tableInfo && tableInfo.sql && tableInfo.sql.includes('BETWEEN 50 AND 150')) {
  golfDb.exec(`
    CREATE TABLE IF NOT EXISTS scores_new (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      score       INTEGER NOT NULL,
      holes       INTEGER NOT NULL DEFAULT 18 CHECK(holes IN (9, 18)),
      date_played TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(player_id, date_played)
    );
    INSERT INTO scores_new (id, player_id, score, holes, date_played, created_at)
      SELECT id, player_id, score, holes, date_played, created_at FROM scores;
    DROP TABLE scores;
    ALTER TABLE scores_new RENAME TO scores;
    CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_id);
    CREATE INDEX IF NOT EXISTS idx_scores_player_date ON scores(player_id, date_played);
  `);
}

// Migration: add course_id column to scores if it doesn't exist
const scoreColumns2 = golfDb.prepare("PRAGMA table_info(scores)").all();
const hasCourseId = scoreColumns2.some(col => col.name === 'course_id');
if (!hasCourseId) {
  golfDb.exec("ALTER TABLE scores ADD COLUMN course_id INTEGER REFERENCES courses(id)");
}

// Migration: add par_front and par_back columns to courses if they don't exist
const courseColumns = golfDb.prepare("PRAGMA table_info(courses)").all();
const hasParFront = courseColumns.some(col => col.name === 'par_front');
const hasParBack  = courseColumns.some(col => col.name === 'par_back');
if (!hasParFront) {
  golfDb.exec("ALTER TABLE courses ADD COLUMN par_front INTEGER NOT NULL DEFAULT 36");
}
if (!hasParBack) {
  golfDb.exec("ALTER TABLE courses ADD COLUMN par_back INTEGER NOT NULL DEFAULT 36");
}

// Migration: add email and phone columns to players if they don't exist
const playerColumns = golfDb.prepare("PRAGMA table_info(players)").all();
const hasEmail = playerColumns.some(col => col.name === 'email');
const hasPhone = playerColumns.some(col => col.name === 'phone');
const hasFirstName = playerColumns.some(col => col.name === 'first_name');
const hasLastName = playerColumns.some(col => col.name === 'last_name');
if (!hasEmail) {
  golfDb.exec("ALTER TABLE players ADD COLUMN email TEXT NOT NULL DEFAULT ''");
}
if (!hasPhone) {
  golfDb.exec("ALTER TABLE players ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
}
if (!hasFirstName) {
  golfDb.exec("ALTER TABLE players ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
}
if (!hasLastName) {
  golfDb.exec("ALTER TABLE players ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
}

// Migration: add archived column to players if it doesn't exist
const playerColumns2 = golfDb.prepare("PRAGMA table_info(players)").all();
const hasArchived = playerColumns2.some(col => col.name === 'archived');
if (!hasArchived) {
  golfDb.exec("ALTER TABLE players ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
}

// Migration: add avatar column to players if it doesn't exist
const playerColumns3 = golfDb.prepare("PRAGMA table_info(players)").all();
const hasAvatar = playerColumns3.some(col => col.name === 'avatar');
if (!hasAvatar) {
  golfDb.exec("ALTER TABLE players ADD COLUMN avatar TEXT DEFAULT NULL");
}

// Migration: add approved column to photos if it doesn't exist
try {
  const photoCols = golfDb.prepare("PRAGMA table_info(photos)").all();
  const hasApproved = photoCols.some(col => col.name === 'approved');
  if (!hasApproved) {
    golfDb.exec("ALTER TABLE photos ADD COLUMN approved INTEGER NOT NULL DEFAULT 0");
  }
} catch (e) { /* photos table may not exist yet — schema will create it */ }

module.exports = golfDb;
