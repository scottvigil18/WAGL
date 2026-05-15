/**
 * Property-Based Tests for Golf League Score Submission (Properties 9–11)
 * Feature: golf-league-handicap-tracker
 *
 * Property 9:  Valid score submission creates an entry
 * Property 10: Duplicate date score submission is rejected
 * Property 11: Invalid score values are rejected
 *
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 10.5
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

/**
 * Validates that a score is a positive integer.
 * Mirrors the logic in golfScores.js.
 */
function isValidScore(value) {
  return Number.isInteger(value) && value > 0;
}

// ─── Test App Factory ─────────────────────────────────────────────────────────

/**
 * Creates a fresh in-memory SQLite database and a minimal Express app that
 * replicates the register, login, and score submission route logic.
 *
 * The handicap client is stubbed to return a dummy handicap_index so the
 * Python service does not need to be running during tests.
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
  // Returns a dummy result so the Python service is never called.
  async function calculateHandicapStub(_scores, _courseRating, _slopeRating) {
    return { handicap_index: 10.0, differentials_used: 1, message: null };
  }

  // ── Shared: recalculateHandicap ──────────────────────────────────────────
  async function recalculateHandicap(playerId) {
    const result = await calculateHandicapStub([], 72.0, 113);
    const existing = db.prepare('SELECT id FROM handicaps WHERE player_id = ?').get(playerId);
    if (existing) {
      db.prepare(
        "UPDATE handicaps SET handicap_index = ?, updated_at = datetime('now') WHERE player_id = ?"
      ).run(result.handicap_index, playerId);
    } else {
      db.prepare(
        'INSERT INTO handicaps (player_id, handicap_index) VALUES (?, ?)'
      ).run(playerId, result.handicap_index);
    }
    return result;
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
  // Replicates golfScores.js POST /scores with the handicap client stubbed.
  app.post('/api/golf/scores', (req, res) => {
    // Auth middleware inline
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
    } catch (_e) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Route handler (async)
    (async () => {
      try {
        const { score, date_played, holes, course_id } = req.body;
        const playerId = req.user.id;

        // Validate score: must be an integer in [50, 150] (Requirement 4.5)
        if (score === undefined || score === null || !isValidScore(score)) {
          return res.status(400).json({ error: 'Score must be a positive integer' });
        }
        if (score < 50 || score > 150) {
          return res.status(400).json({ error: 'Score must be between 50 and 150' });
        }

        // Validate holes (default to 18 if not provided)
        const holesValue = (holes !== undefined && holes !== null) ? holes : 18;
        if (holesValue !== 9 && holesValue !== 18) {
          return res.status(400).json({ error: 'Holes must be 9 or 18' });
        }

        // Validate course_id if provided
        let courseIdValue = null;
        if (course_id !== undefined && course_id !== null) {
          const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(course_id);
          if (!course) {
            return res.status(400).json({ error: 'Invalid course_id' });
          }
          courseIdValue = course_id;
        }

        // Validate date_played
        if (!date_played || !isValidDate(date_played)) {
          return res.status(400).json({ error: 'date_played must be a valid ISO 8601 date (YYYY-MM-DD)' });
        }

        // Insert score — UNIQUE constraint catches duplicates
        let insertResult;
        try {
          insertResult = db.prepare(
            'INSERT INTO scores (player_id, score, holes, course_id, date_played) VALUES (?, ?, ?, ?, ?)'
          ).run(playerId, score, holesValue, courseIdValue, date_played);
        } catch (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Score already submitted for this date' });
          }
          // SQLite CHECK constraint violation (score out of 50–150 range)
          if (err.code === 'SQLITE_CONSTRAINT_CHECK' || (err.message && err.message.includes('CHECK'))) {
            return res.status(400).json({ error: 'Score must be between 50 and 150' });
          }
          throw err;
        }

        // Recalculate handicap (stubbed)
        await recalculateHandicap(playerId);

        // Fetch the created entry
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

  return { app, db };
}

// ─── Helpers: register a player and get a JWT ─────────────────────────────────

/**
 * Registers a player and returns their JWT token and player ID.
 * Uses a fixed username/password to avoid bcrypt overhead in every iteration.
 */
async function registerAndLogin(app, username, password) {
  const regRes = await request(app)
    .post('/api/golf/register')
    .send({ username, password });

  if (regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
  }

  const loginRes = await request(app)
    .post('/api/golf/login')
    .send({ username, password });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return { token: loginRes.body.token, playerId: loginRes.body.id };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

// Valid username: 3–15 alphanumeric/underscore characters
const validUsernameArb = fc.stringMatching(/^[a-zA-Z0-9_]{3,15}$/);

// Valid password: 6–20 printable ASCII characters
const validPasswordArb = fc.stringMatching(/^[a-zA-Z0-9!@#$%^&*()_+\-=]{6,20}$/);

// Valid score: integer in [50, 150]
const validScoreArb = fc.integer({ min: 50, max: 150 });

// Valid ISO 8601 date: YYYY-MM-DD in a reasonable range
const validDateArb = fc.record({
  year: fc.integer({ min: 2000, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }) // cap at 28 to avoid invalid dates like Feb 30
}).map(({ year, month, day }) => {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
});

// Out-of-range scores: integers below 50 or above 150
const outOfRangeScoreArb = fc.oneof(
  fc.integer({ min: -1000, max: 49 }),
  fc.integer({ min: 151, max: 1000 })
);

// Non-integer score values: floats, strings, null, booleans, objects
const nonIntegerScoreArb = fc.oneof(
  fc.double({ min: 50.1, max: 149.9, noNaN: true, noDefaultInfinity: true }),
  fc.constant('eighty'),
  fc.constant('100'),
  fc.constant(null),
  fc.constant(true),
  fc.constant(false),
  fc.constant({}),
  fc.constant([])
);

// Invalid date strings: wrong formats, nonsense strings, empty
const invalidDateArb = fc.oneof(
  fc.constant(''),
  fc.constant('not-a-date'),
  fc.constant('2024/06/15'),
  fc.constant('15-06-2024'),
  fc.constant('2024-13-01'),  // invalid month
  fc.constant('2024-00-01'),  // invalid month
  fc.constant('2024-06-32'),  // invalid day
  fc.constant('2024-06'),     // missing day
  fc.constant('20240615'),    // no separators
  fc.constant('2024-6-5'),    // no zero-padding
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(12345),
  fc.stringMatching(/^[a-zA-Z]{3,10}$/) // random letters
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Feature: golf-league-handicap-tracker', () => {
  /**
   * Property 9: Valid score submission creates an entry
   * Validates: Requirements 4.2, 4.3
   *
   * For any authenticated player, valid score (integer 50–150), and valid ISO 8601
   * date not already used by that player, submitting a score should return HTTP 201
   * and the created entry should be linked to the authenticated player's ID.
   */
  describe('Property 9: Valid score submission creates an entry', () => {
    it('should return 201 and link the entry to the authenticated player', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          validScoreArb,
          validDateArb,
          async (username, password, score, date_played) => {
            // Fresh isolated environment per iteration
            const { app, db } = createTestApp();
            try {
              const { token, playerId } = await registerAndLogin(app, username, password);

              const res = await request(app)
                .post('/api/golf/scores')
                .set('Authorization', `Bearer ${token}`)
                .send({ score, date_played });

              // Must return 201
              expect(res.status).toBe(201);

              // Response body must contain the created entry fields
              expect(res.body).toHaveProperty('id');
              expect(res.body).toHaveProperty('score', score);
              expect(res.body).toHaveProperty('date_played', date_played);

              // Entry must be linked to the authenticated player's ID
              expect(res.body).toHaveProperty('player_id', playerId);

              // Verify the entry exists in the database
              const entry = db.prepare('SELECT * FROM scores WHERE id = ?').get(res.body.id);
              expect(entry).toBeDefined();
              expect(entry.player_id).toBe(playerId);
              expect(entry.score).toBe(score);
              expect(entry.date_played).toBe(date_played);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);
  });

  /**
   * Property 10: Duplicate date score submission is rejected
   * Validates: Requirements 4.4, 10.5
   *
   * For any player and date, if a score already exists for that (player, date)
   * combination, a subsequent submission for the same date should return HTTP 409
   * and the original score should remain unchanged.
   */
  describe('Property 10: Duplicate date score submission is rejected', () => {
    it('should return 409 on duplicate (player, date) and leave the original score unchanged', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          validScoreArb,
          validScoreArb,
          validDateArb,
          async (username, password, score1, score2, date_played) => {
            const { app, db } = createTestApp();
            try {
              const { token, playerId } = await registerAndLogin(app, username, password);

              // First submission — should succeed
              const res1 = await request(app)
                .post('/api/golf/scores')
                .set('Authorization', `Bearer ${token}`)
                .send({ score: score1, date_played });

              expect(res1.status).toBe(201);
              const originalEntryId = res1.body.id;

              // Second submission for the same date — should be rejected
              const res2 = await request(app)
                .post('/api/golf/scores')
                .set('Authorization', `Bearer ${token}`)
                .send({ score: score2, date_played });

              expect(res2.status).toBe(409);
              expect(res2.body).toHaveProperty('error');
              expect(res2.body.error).toMatch(/already submitted/i);

              // Original score must remain unchanged in the database
              const original = db.prepare('SELECT * FROM scores WHERE id = ?').get(originalEntryId);
              expect(original).toBeDefined();
              expect(original.score).toBe(score1);
              expect(original.player_id).toBe(playerId);

              // Only one score entry should exist for this player/date
              const count = db.prepare(
                'SELECT COUNT(*) AS count FROM scores WHERE player_id = ? AND date_played = ?'
              ).get(playerId, date_played);
              expect(count.count).toBe(1);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);
  });

  /**
   * Property 11: Invalid score values are rejected
   * Validates: Requirements 4.5, 4.6
   *
   * For any score value that is not an integer or falls outside the range 50–150,
   * and for any missing or invalid ISO 8601 date string, the score submission
   * endpoint should return HTTP 400 and no score record should be created.
   */
  describe('Property 11: Invalid score values are rejected', () => {
    it('should return 400 for out-of-range integer scores (< 50 or > 150)', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          outOfRangeScoreArb,
          validDateArb,
          async (username, password, score, date_played) => {
            const { app, db } = createTestApp();
            try {
              const { token } = await registerAndLogin(app, username, password);

              const res = await request(app)
                .post('/api/golf/scores')
                .set('Authorization', `Bearer ${token}`)
                .send({ score, date_played });

              // Must be rejected — either 400 (JS validation) or 400 (SQLite CHECK)
              expect(res.status).toBe(400);
              expect(res.body).toHaveProperty('error');

              // No score record should be created
              const count = db.prepare('SELECT COUNT(*) AS count FROM scores').get();
              expect(count.count).toBe(0);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should return 400 for non-integer score values', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          nonIntegerScoreArb,
          validDateArb,
          async (username, password, score, date_played) => {
            const { app, db } = createTestApp();
            try {
              const { token } = await registerAndLogin(app, username, password);

              const res = await request(app)
                .post('/api/golf/scores')
                .set('Authorization', `Bearer ${token}`)
                .send({ score, date_played });

              expect(res.status).toBe(400);
              expect(res.body).toHaveProperty('error');

              // No score record should be created
              const count = db.prepare('SELECT COUNT(*) AS count FROM scores').get();
              expect(count.count).toBe(0);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should return 400 when score field is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          validDateArb,
          async (username, password, date_played) => {
            const { app, db } = createTestApp();
            try {
              const { token } = await registerAndLogin(app, username, password);

              const res = await request(app)
                .post('/api/golf/scores')
                .set('Authorization', `Bearer ${token}`)
                .send({ date_played }); // no score field

              expect(res.status).toBe(400);
              expect(res.body).toHaveProperty('error');

              const count = db.prepare('SELECT COUNT(*) AS count FROM scores').get();
              expect(count.count).toBe(0);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should return 400 for invalid ISO 8601 date strings', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          validScoreArb,
          invalidDateArb,
          async (username, password, score, date_played) => {
            const { app, db } = createTestApp();
            try {
              const { token } = await registerAndLogin(app, username, password);

              const res = await request(app)
                .post('/api/golf/scores')
                .set('Authorization', `Bearer ${token}`)
                .send({ score, date_played });

              expect(res.status).toBe(400);
              expect(res.body).toHaveProperty('error');

              // No score record should be created
              const count = db.prepare('SELECT COUNT(*) AS count FROM scores').get();
              expect(count.count).toBe(0);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);

    it('should return 400 when date_played field is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          validScoreArb,
          async (username, password, score) => {
            const { app, db } = createTestApp();
            try {
              const { token } = await registerAndLogin(app, username, password);

              const res = await request(app)
                .post('/api/golf/scores')
                .set('Authorization', `Bearer ${token}`)
                .send({ score }); // no date_played field

              expect(res.status).toBe(400);
              expect(res.body).toHaveProperty('error');

              const count = db.prepare('SELECT COUNT(*) AS count FROM scores').get();
              expect(count.count).toBe(0);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 180000);
  });
});
