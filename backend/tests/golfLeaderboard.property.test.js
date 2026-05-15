/**
 * Property-Based Tests for Golf League Leaderboard and Score History (Properties 14–15)
 * Feature: golf-league-handicap-tracker
 *
 * Property 14: Leaderboard completeness and sorting
 * Property 15: Score history returns correct ordered entries
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 8.1, 8.2
 */
const fc = require('fast-check');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ─── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = 'golf-league-secret-key';
const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'db', 'golfSchema.sql');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates an ISO 8601 date string (YYYY-MM-DD format).
 * Mirrors the logic in golfScores.js.
 */
function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// ─── Test App Factory ─────────────────────────────────────────────────────────

/**
 * Creates a fresh in-memory SQLite database and a minimal Express app that
 * replicates the register, login, score submission, leaderboard, and score
 * history route logic.
 *
 * The handicap client is stubbed so the Python service is never called.
 * The stub accepts a handicap_index override so tests can control the value
 * stored for each player.
 *
 * Each call returns a completely isolated { app, db } pair.
 */
function createTestApp() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);

  const app = express();
  app.use(express.json());

  // ── Stub: calculateHandicap ──────────────────────────────────────────────
  // Returns a fixed dummy handicap so the Python service is never called.
  async function calculateHandicapStub() {
    return { handicap_index: 10.0, differentials_used: 1, message: null };
  }

  // ── Shared: recalculateHandicap ──────────────────────────────────────────
  async function recalculateHandicap(playerId, handicapOverride) {
    const result = await calculateHandicapStub();
    const handicapValue = handicapOverride !== undefined ? handicapOverride : result.handicap_index;

    const existing = db.prepare('SELECT id FROM handicaps WHERE player_id = ?').get(playerId);
    if (existing) {
      db.prepare(
        "UPDATE handicaps SET handicap_index = ?, updated_at = datetime('now') WHERE player_id = ?"
      ).run(handicapValue, playerId);
    } else {
      db.prepare(
        'INSERT INTO handicaps (player_id, handicap_index) VALUES (?, ?)'
      ).run(playerId, handicapValue);
    }
    return { handicap_index: handicapValue };
  }

  // ── Inline auth middleware ───────────────────────────────────────────────
  function authMiddleware(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (_e) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      req.user = { id: decoded.id, role: decoded.role };
      next();
    } catch (_e) {
      return res.status(401).json({ error: 'Authentication required' });
    }
  }

  // ── POST /api/golf/register ──────────────────────────────────────────────
  app.post('/api/golf/register', (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const playerCount = db.prepare('SELECT COUNT(*) AS count FROM players').get();
      if (playerCount.count >= 50) {
        return res.status(403).json({ error: 'League is full' });
      }

      const existing = db.prepare('SELECT id FROM players WHERE username = ?').get(username.trim());
      if (existing) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      // Cost 4 for test speed
      const passwordHash = bcrypt.hashSync(password, 4);
      const result = db.prepare(
        "INSERT INTO players (username, password_hash, role) VALUES (?, ?, 'player')"
      ).run(username.trim(), passwordHash);

      return res.status(201).json({ id: result.lastInsertRowid, username: username.trim() });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Username already exists' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/golf/login ─────────────────────────────────────────────────
  app.post('/api/golf/login', (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const player = db.prepare(
        'SELECT id, username, password_hash, role FROM players WHERE username = ?'
      ).get(username);

      if (!player) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = bcrypt.compareSync(password, player.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: player.id, role: player.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({ token, id: player.id, username: player.username, role: player.role });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/golf/scores ────────────────────────────────────────────────
  // Accepts an optional x-handicap-override header for test control.
  app.post('/api/golf/scores', authMiddleware, (req, res) => {
    (async () => {
      try {
        const { score, date_played } = req.body;
        const playerId = req.user.id;

        // Validate score: must be an integer in [50, 150]
        if (score === undefined || score === null || !Number.isInteger(score)) {
          return res.status(400).json({ error: 'Score must be a positive integer' });
        }
        if (score < 50 || score > 150) {
          return res.status(400).json({ error: 'Score must be between 50 and 150' });
        }

        // Validate date_played
        if (!date_played || !isValidDate(date_played)) {
          return res.status(400).json({ error: 'date_played must be a valid ISO 8601 date (YYYY-MM-DD)' });
        }

        // Insert score — UNIQUE constraint catches duplicates
        let insertResult;
        try {
          insertResult = db.prepare(
            'INSERT INTO scores (player_id, score, holes, course_id, date_played) VALUES (?, ?, 18, NULL, ?)'
          ).run(playerId, score, date_played);
        } catch (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Score already submitted for this date' });
          }
          throw err;
        }

        // Read optional handicap override from header (test-only mechanism)
        const handicapOverride = req.headers['x-handicap-override'] !== undefined
          ? parseFloat(req.headers['x-handicap-override'])
          : undefined;

        await recalculateHandicap(playerId, handicapOverride);

        const created = db.prepare(
          'SELECT id, player_id, score, holes, course_id, date_played, created_at FROM scores WHERE id = ?'
        ).get(insertResult.lastInsertRowid);

        return res.status(201).json(created);
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({ error: 'Score already submitted for this date' });
        }
        return res.status(500).json({ error: 'Internal server error' });
      }
    })();
  });

  // ── GET /api/golf/leaderboard ────────────────────────────────────────────
  // Public endpoint: all players with most recent score and handicap_index,
  // sorted by handicap_index ASC (nulls last).
  app.get('/api/golf/leaderboard', (req, res) => {
    try {
      const leaderboard = db.prepare(`
        SELECT
          p.id,
          p.username,
          rs.score AS most_recent_score,
          rs.date_played,
          h.handicap_index
        FROM players p
        LEFT JOIN (
          SELECT s1.player_id, s1.score, s1.date_played
          FROM scores s1
          INNER JOIN (
            SELECT player_id, MAX(date_played) AS max_date
            FROM scores
            GROUP BY player_id
          ) s2 ON s1.player_id = s2.player_id AND s1.date_played = s2.max_date
        ) rs ON p.id = rs.player_id
        LEFT JOIN handicaps h ON p.id = h.player_id
        ORDER BY
          CASE WHEN h.handicap_index IS NULL THEN 1 ELSE 0 END,
          h.handicap_index ASC
      `).all();

      return res.status(200).json(leaderboard);
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/golf/scores/me ──────────────────────────────────────────────
  // Authenticated: return all scores for the current player, date_played DESC.
  app.get('/api/golf/scores/me', authMiddleware, (req, res) => {
    try {
      const playerId = req.user.id;

      const scores = db.prepare(
        `SELECT id, score, date_played, created_at
         FROM scores
         WHERE player_id = ?
         ORDER BY date_played DESC`
      ).all(playerId);

      return res.status(200).json(scores);
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return { app, db };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Registers a player and returns their JWT token and player ID.
 */
async function registerAndLogin(app, username, password) {
  const regRes = await request(app)
    .post('/api/golf/register')
    .send({ username, password });

  if (regRes.status !== 201) {
    throw new Error(`Registration failed for "${username}": ${JSON.stringify(regRes.body)}`);
  }

  const loginRes = await request(app)
    .post('/api/golf/login')
    .send({ username, password });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed for "${username}": ${JSON.stringify(loginRes.body)}`);
  }

  return { token: loginRes.body.token, playerId: loginRes.body.id };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

// Valid username: 3–12 alphanumeric/underscore characters
const validUsernameArb = fc.stringMatching(/^[a-zA-Z0-9_]{3,12}$/);

// Valid password: 6–20 printable ASCII characters
const validPasswordArb = fc.stringMatching(/^[a-zA-Z0-9!@#$%^&*()_+\-=]{6,20}$/);

// Valid score: integer in [50, 150]
const validScoreArb = fc.integer({ min: 50, max: 150 });

// Valid ISO 8601 date: YYYY-MM-DD in a reasonable range, day capped at 28 to
// avoid invalid calendar dates (e.g. Feb 30).
const validDateArb = fc.record({
  year: fc.integer({ min: 2000, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 })
}).map(({ year, month, day }) => {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
});

// Handicap index: a real number in a realistic range, or null (no scores yet)
const handicapIndexArb = fc.oneof(
  fc.double({ min: 0.0, max: 54.0, noNaN: true, noDefaultInfinity: true }).map(v => Math.round(v * 10) / 10),
  fc.constant(null)
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Feature: golf-league-handicap-tracker', () => {
  /**
   * Property 14: Leaderboard completeness and sorting
   * Validates: Requirements 6.1, 6.2, 6.3
   *
   * For any set of registered players (with or without scores), the leaderboard
   * endpoint should return all players with their username, most recent score,
   * date_played, and handicap_index, sorted by handicap_index in ascending order
   * (nulls last).
   */
  describe('Property 14: Leaderboard completeness and sorting', () => {
    it('should return all players sorted by handicap_index ASC (nulls last)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1–5 players, each with a distinct username suffix and
          // an optional handicap index (null means no scores submitted).
          fc.array(
            fc.record({
              userSuffix: fc.integer({ min: 1000, max: 9999 }),
              handicap: handicapIndexArb,
              score: validScoreArb,
              date: validDateArb
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (players) => {
            // Fresh isolated environment per iteration
            const { app, db } = createTestApp();
            try {
              const password = 'password123';
              const registeredPlayers = [];

              // Register each player with a unique username
              for (let i = 0; i < players.length; i++) {
                const p = players[i];
                const username = `usr${p.userSuffix}${i}`;

                // Skip if username collision (shouldn't happen with suffix+index but be safe)
                const existing = db.prepare('SELECT id FROM players WHERE username = ?').get(username);
                if (existing) continue;

                const { token, playerId } = await registerAndLogin(app, username, password);
                registeredPlayers.push({ username, token, playerId, handicap: p.handicap, score: p.score, date: p.date });
              }

              if (registeredPlayers.length === 0) return;

              // For players that should have a handicap, submit a score with the
              // handicap override header so we control the stored handicap_index.
              for (const rp of registeredPlayers) {
                if (rp.handicap !== null) {
                  const scoreRes = await request(app)
                    .post('/api/golf/scores')
                    .set('Authorization', `Bearer ${rp.token}`)
                    .set('x-handicap-override', String(rp.handicap))
                    .send({ score: rp.score, date_played: rp.date });

                  // 201 or 409 (duplicate date from another player in same iteration) are both fine
                  expect([201, 409]).toContain(scoreRes.status);
                }
                // Players with handicap === null get no score submitted — they appear with nulls
              }

              // Fetch the leaderboard
              const lbRes = await request(app).get('/api/golf/leaderboard');
              expect(lbRes.status).toBe(200);
              expect(Array.isArray(lbRes.body)).toBe(true);

              const leaderboard = lbRes.body;

              // ── Completeness: every registered player must appear ──────────
              for (const rp of registeredPlayers) {
                const entry = leaderboard.find(e => e.username === rp.username);
                expect(entry).toBeDefined();
              }

              // ── Field presence: each entry must have the required fields ───
              for (const entry of leaderboard) {
                expect(entry).toHaveProperty('username');
                // most_recent_score may be null for players without scores
                expect(Object.prototype.hasOwnProperty.call(entry, 'most_recent_score')).toBe(true);
                expect(Object.prototype.hasOwnProperty.call(entry, 'date_played')).toBe(true);
                expect(Object.prototype.hasOwnProperty.call(entry, 'handicap_index')).toBe(true);
              }

              // ── Sorting: handicap_index ASC, nulls last ────────────────────
              // Collect non-null handicap entries and null entries separately
              const withHandicap = leaderboard.filter(e => e.handicap_index !== null);
              const withoutHandicap = leaderboard.filter(e => e.handicap_index === null);

              // All entries with a handicap must come before entries without
              const firstNullIdx = leaderboard.findIndex(e => e.handicap_index === null);
              const lastNonNullIdx = leaderboard.map(e => e.handicap_index !== null).lastIndexOf(true);

              if (firstNullIdx !== -1 && lastNonNullIdx !== -1) {
                expect(firstNullIdx).toBeGreaterThan(lastNonNullIdx);
              }

              // Non-null entries must be in ascending order
              for (let i = 1; i < withHandicap.length; i++) {
                expect(withHandicap[i].handicap_index).toBeGreaterThanOrEqual(withHandicap[i - 1].handicap_index);
              }

              // Players without scores must have null score, date_played, and handicap_index
              for (const rp of registeredPlayers) {
                if (rp.handicap === null) {
                  const entry = leaderboard.find(e => e.username === rp.username);
                  if (entry) {
                    // A player with no submitted scores should have null values
                    // (unless another iteration coincidentally gave them a score — not possible
                    // since we use a fresh DB per iteration)
                    expect(entry.most_recent_score).toBeNull();
                    expect(entry.date_played).toBeNull();
                    expect(entry.handicap_index).toBeNull();
                  }
                }
              }
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 300000);
  });

  /**
   * Property 15: Score history returns correct ordered entries
   * Validates: Requirements 8.1, 8.2
   *
   * For any authenticated player with submitted scores, the GET /api/golf/scores/me
   * endpoint should return all of that player's scores ordered by date_played
   * descending, each containing id, score, date_played, and created_at fields.
   */
  describe('Property 15: Score history returns correct ordered entries', () => {
    it('should return all scores ordered by date_played DESC with correct fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          // Generate 1–8 unique dates and scores for the player
          fc.array(
            fc.record({
              score: validScoreArb,
              date: validDateArb
            }),
            { minLength: 1, maxLength: 8 }
          ),
          async (username, password, scoreEntries) => {
            // Fresh isolated environment per iteration
            const { app, db } = createTestApp();
            try {
              const { token, playerId } = await registerAndLogin(app, username, password);

              // Deduplicate dates — the endpoint enforces one score per date
              const seenDates = new Set();
              const uniqueEntries = [];
              for (const entry of scoreEntries) {
                if (!seenDates.has(entry.date)) {
                  seenDates.add(entry.date);
                  uniqueEntries.push(entry);
                }
              }

              // Submit each unique score
              const submittedEntries = [];
              for (const entry of uniqueEntries) {
                const res = await request(app)
                  .post('/api/golf/scores')
                  .set('Authorization', `Bearer ${token}`)
                  .send({ score: entry.score, date_played: entry.date });

                expect(res.status).toBe(201);
                submittedEntries.push({ score: entry.score, date_played: entry.date, id: res.body.id });
              }

              // Fetch score history
              const histRes = await request(app)
                .get('/api/golf/scores/me')
                .set('Authorization', `Bearer ${token}`);

              expect(histRes.status).toBe(200);
              expect(Array.isArray(histRes.body)).toBe(true);

              const history = histRes.body;

              // ── Completeness: all submitted scores must be present ─────────
              expect(history.length).toBe(submittedEntries.length);

              for (const submitted of submittedEntries) {
                const found = history.find(h => h.id === submitted.id);
                expect(found).toBeDefined();
                expect(found.score).toBe(submitted.score);
                expect(found.date_played).toBe(submitted.date_played);
              }

              // ── Field presence: each entry must have required fields ───────
              for (const entry of history) {
                expect(entry).toHaveProperty('id');
                expect(typeof entry.id).toBe('number');

                expect(entry).toHaveProperty('score');
                expect(typeof entry.score).toBe('number');

                expect(entry).toHaveProperty('date_played');
                expect(typeof entry.date_played).toBe('string');

                expect(entry).toHaveProperty('created_at');
                expect(typeof entry.created_at).toBe('string');
              }

              // ── Ordering: date_played must be descending ───────────────────
              for (let i = 1; i < history.length; i++) {
                const prev = history[i - 1].date_played;
                const curr = history[i].date_played;
                // String comparison works for YYYY-MM-DD format
                expect(prev >= curr).toBe(true);
              }

              // ── Isolation: only this player's scores are returned ──────────
              for (const entry of history) {
                const dbEntry = db.prepare('SELECT player_id FROM scores WHERE id = ?').get(entry.id);
                expect(dbEntry).toBeDefined();
                expect(dbEntry.player_id).toBe(playerId);
              }
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 300000);
  });
});
