/**
 * WAGL Test Data Seeder
 * Creates 18 test players with low/mid/high handicaps and populates scores.
 * Run: node seed-test-data.js
 * Remove: node seed-test-data.js --remove
 */

const bcrypt = require('bcryptjs');
const db = require('./src/db/golfDatabase');

const TEST_PREFIX = 'TEST_';

// 18 test players: 6 low, 6 mid, 6 high handicap
const TEST_PLAYERS = [
  // Low handicap (2-8) — strong players, scores around 33-38 for 9 holes
  { username: 'TEST_JohnA', first_name: 'John', last_name: 'Anderson', handicap: 3.2, avgScore: 34 },
  { username: 'TEST_MikeB', first_name: 'Mike', last_name: 'Bradley', handicap: 4.8, avgScore: 35 },
  { username: 'TEST_DaveC', first_name: 'Dave', last_name: 'Carter', handicap: 5.5, avgScore: 36 },
  { username: 'TEST_TomD', first_name: 'Tom', last_name: 'Davis', handicap: 6.1, avgScore: 36 },
  { username: 'TEST_JakeE', first_name: 'Jake', last_name: 'Evans', handicap: 7.0, avgScore: 37 },
  { username: 'TEST_RyanF', first_name: 'Ryan', last_name: 'Foster', handicap: 7.8, avgScore: 37 },
  // Mid handicap (10-16) — average players, scores around 39-44
  { username: 'TEST_ChrisG', first_name: 'Chris', last_name: 'Garcia', handicap: 10.2, avgScore: 40 },
  { username: 'TEST_BrianH', first_name: 'Brian', last_name: 'Harris', handicap: 11.5, avgScore: 41 },
  { username: 'TEST_MarkI', first_name: 'Mark', last_name: 'Irving', handicap: 12.8, avgScore: 42 },
  { username: 'TEST_SteveJ', first_name: 'Steve', last_name: 'Johnson', handicap: 13.4, avgScore: 42 },
  { username: 'TEST_PaulK', first_name: 'Paul', last_name: 'King', handicap: 14.9, avgScore: 43 },
  { username: 'TEST_JeffL', first_name: 'Jeff', last_name: 'Lewis', handicap: 15.7, avgScore: 44 },
  // High handicap (18-28) — newer players, scores around 45-54
  { username: 'TEST_BobM', first_name: 'Bob', last_name: 'Miller', handicap: 18.3, avgScore: 46 },
  { username: 'TEST_DanN', first_name: 'Dan', last_name: 'Nelson', handicap: 20.1, avgScore: 48 },
  { username: 'TEST_GregO', first_name: 'Greg', last_name: 'Olson', handicap: 22.5, avgScore: 49 },
  { username: 'TEST_KenP', first_name: 'Ken', last_name: 'Parker', handicap: 24.0, avgScore: 51 },
  { username: 'TEST_LarryQ', first_name: 'Larry', last_name: 'Quinn', handicap: 25.8, avgScore: 52 },
  { username: 'TEST_SamR', first_name: 'Sam', last_name: 'Roberts', handicap: 27.4, avgScore: 54 },
];

// WAGL schedule dates (first 5 events for test data)
const EVENT_DATES = [
  '2026-04-16', '2026-04-23', '2026-04-30', '2026-05-07', '2026-05-14',
];

// Course IDs (from the seeded courses)
const COURSE_IDS = [3, 13, 15, 4, 16]; // Barn, Glen Eagle, Schneiter's Bluff, Mt Ogden, Sun Hills

function randomVariance(base, range) {
  return base + Math.floor(Math.random() * range * 2) - range;
}

// Weekly points: 3 min, 7 max — assigned based on relative performance within flight
function assignWeeklyPoints(scores) {
  // Sort by score (lower is better)
  const sorted = [...scores].sort((a, b) => a.score - b.score);
  const count = sorted.length;
  return sorted.map((s, idx) => {
    // Best gets 7, worst gets 3, linear interpolation
    const points = Math.round(7 - (idx / Math.max(count - 1, 1)) * 4);
    return { ...s, points: Math.max(3, Math.min(7, points)) };
  });
}

function seedTestData() {
  console.log('Seeding 18 test players...');
  const passwordHash = bcrypt.hashSync('test123', 10);

  const insertPlayer = db.prepare(
    "INSERT OR IGNORE INTO players (username, password_hash, first_name, last_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?, 'player')"
  );

  const insertScore = db.prepare(
    'INSERT OR IGNORE INTO scores (player_id, score, holes, course_id, date_played) VALUES (?, ?, 9, ?, ?)'
  );

  const upsertHandicap = db.prepare(
    'INSERT OR REPLACE INTO handicaps (player_id, handicap_index) VALUES (?, ?)'
  );

  const seedAll = db.transaction(() => {
    for (const p of TEST_PLAYERS) {
      insertPlayer.run(
        p.username, passwordHash, p.first_name, p.last_name,
        `${p.first_name.toLowerCase()}@test.wagl`, '801-555-0000'
      );

      const player = db.prepare('SELECT id FROM players WHERE username = ?').get(p.username);
      if (!player) continue;

      // Insert handicap
      upsertHandicap.run(player.id, p.handicap);

      // Insert scores for each event
      for (let i = 0; i < EVENT_DATES.length; i++) {
        const score = randomVariance(p.avgScore, 3);
        insertScore.run(player.id, Math.max(28, score), COURSE_IDS[i], EVENT_DATES[i]);
      }
    }
  });

  seedAll();

  // Now calculate and display weekly points
  console.log('\nWeekly Points Summary:');
  for (let i = 0; i < EVENT_DATES.length; i++) {
    const scores = db.prepare(`
      SELECT s.player_id, p.username, s.score
      FROM scores s JOIN players p ON s.player_id = p.id
      WHERE s.date_played = ? AND p.username LIKE 'TEST_%'
    `).all(EVENT_DATES[i]);

    const withPoints = assignWeeklyPoints(scores);
    console.log(`\n  Event ${i + 1} (${EVENT_DATES[i]}):`);
    for (const s of withPoints) {
      console.log(`    ${s.username.padEnd(15)} Score: ${s.score}  Points: ${s.points}`);
    }
  }

  const count = db.prepare("SELECT COUNT(*) AS c FROM players WHERE username LIKE 'TEST_%'").get();
  console.log(`\n✅ Done! ${count.c} test players created with scores across ${EVENT_DATES.length} events.`);
  console.log('   All test accounts use password: test123');
  console.log('   To remove: node seed-test-data.js --remove');
}

function removeTestData() {
  console.log('Removing all test data...');

  const testPlayers = db.prepare("SELECT id FROM players WHERE username LIKE 'TEST_%'").all();
  const ids = testPlayers.map(p => p.id);

  if (ids.length === 0) {
    console.log('No test data found.');
    return;
  }

  const deleteScores = db.prepare('DELETE FROM scores WHERE player_id = ?');
  const deleteHandicaps = db.prepare('DELETE FROM handicaps WHERE player_id = ?');
  const deleteRsvps = db.prepare('DELETE FROM rsvps WHERE player_id = ?');
  const deleteNotifs = db.prepare('DELETE FROM notifications WHERE player_id = ?');
  const deleteMessages = db.prepare('DELETE FROM messages WHERE player_id = ?');
  const deletePhotos = db.prepare('DELETE FROM photos WHERE player_id = ?');
  const deletePlayer = db.prepare('DELETE FROM players WHERE id = ?');

  const removeAll = db.transaction(() => {
    for (const id of ids) {
      deleteScores.run(id);
      deleteHandicaps.run(id);
      deleteRsvps.run(id);
      deleteNotifs.run(id);
      deleteMessages.run(id);
      deletePhotos.run(id);
      deletePlayer.run(id);
    }
  });

  removeAll();
  console.log(`✅ Removed ${ids.length} test players and all associated data.`);
}

// Run
if (process.argv.includes('--remove')) {
  removeTestData();
} else {
  seedTestData();
}
