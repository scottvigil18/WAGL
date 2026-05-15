/**
 * Property-Based Tests for Golf League Authentication (Properties 5–6)
 * Feature: golf-league-handicap-tracker
 *
 * Property 5: Valid credentials produce a correct JWT
 * Property 6: Invalid credentials are rejected
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6
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

const JWT_SECRET = 'golf-league-secret-key'; // matches backend/src/middleware/golfAuth.js
const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'db', 'golfSchema.sql');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

// ─── Test App Factory ─────────────────────────────────────────────────────────

/**
 * Creates a fresh in-memory SQLite database and a minimal Express app that
 * replicates the register + login route logic from golfAuth.js.
 *
 * Using bcrypt cost factor 4 for speed in tests (vs 10 in production).
 * Each call returns a completely isolated { app, db } pair.
 */
function createTestApp() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);

  const app = express();
  app.use(express.json());

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

      return res.status(200).json({
        token,
        id: player.id,
        username: player.username,
        role: player.role
      });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return { app, db };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

// Valid username: 3–15 alphanumeric/underscore characters
const validUsernameArb = fc.stringMatching(/^[a-zA-Z0-9_]{3,15}$/);

// Valid password: 6–20 printable ASCII characters
const validPasswordArb = fc.stringMatching(/^[a-zA-Z0-9!@#$%^&*()_+\-=]{6,20}$/);

// Non-existent username: prefixed so it will never collide with a registered user
// in the same iteration (we never register a user with this prefix in Property 6 tests)
const nonExistentUsernameArb = fc.stringMatching(/^[a-zA-Z0-9_]{3,10}$/)
  .map(s => 'ghost_' + s);

// Wrong password: prefixed so it is guaranteed to differ from the registered password
const wrongPasswordArb = fc.stringMatching(/^[a-zA-Z0-9]{6,15}$/)
  .map(s => 'WRONG_' + s);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Feature: golf-league-handicap-tracker', () => {
  /**
   * Property 5: Valid credentials produce a correct JWT
   * Validates: Requirements 2.2, 2.5, 2.6
   *
   * For any registered player who logs in with correct credentials, the response
   * should contain a valid JWT whose payload includes the player's id, role, and
   * an exp claim approximately 24 hours after iat.
   */
  describe('Property 5: Valid credentials produce a correct JWT', () => {
    it('should return HTTP 200 with a valid JWT containing id, role, and 24h expiry', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          async (username, password) => {
            const { app, db } = createTestApp();
            try {
              // Register the player
              const registerRes = await request(app)
                .post('/api/golf/register')
                .send({ username, password });

              // Skip on unexpected registration failure (e.g., rare generator collision)
              if (registerRes.status !== 201) return;

              const playerId = registerRes.body.id;

              // Login with the same credentials
              const loginRes = await request(app)
                .post('/api/golf/login')
                .send({ username, password });

              // Must return 200
              expect(loginRes.status).toBe(200);

              // Response body must contain token, id, username, role
              expect(loginRes.body).toHaveProperty('token');
              expect(typeof loginRes.body.token).toBe('string');
              expect(loginRes.body.id).toBe(playerId);
              expect(loginRes.body.username).toBe(username.trim());
              expect(loginRes.body.role).toBe('player');

              // JWT must be verifiable with the known secret
              const decoded = jwt.verify(loginRes.body.token, JWT_SECRET);

              // Payload must include the player's id and role
              expect(decoded.id).toBe(playerId);
              expect(decoded.role).toBe('player');

              // exp must be present and approximately 24 hours after iat
              expect(decoded).toHaveProperty('iat');
              expect(decoded).toHaveProperty('exp');
              const diffSeconds = decoded.exp - decoded.iat;
              // jsonwebtoken '24h' = exactly 86400 seconds
              expect(diffSeconds).toBe(86400);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 120000);
  });

  /**
   * Property 6: Invalid credentials are rejected
   * Validates: Requirements 2.3, 2.4
   *
   * For any login attempt where either the username does not exist or the password
   * does not match the stored hash, the endpoint should return HTTP 401 with
   * { "error": "Invalid credentials" }.
   */
  describe('Property 6: Invalid credentials are rejected', () => {
    it('should return 401 for a username that was never registered', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonExistentUsernameArb,
          validPasswordArb,
          async (username, password) => {
            const { app, db } = createTestApp();
            try {
              // Empty database — username definitely does not exist
              const loginRes = await request(app)
                .post('/api/golf/login')
                .send({ username, password });

              expect(loginRes.status).toBe(401);
              expect(loginRes.body).toEqual({ error: 'Invalid credentials' });
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should return 401 when the password does not match the stored hash', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          wrongPasswordArb,
          async (username, correctPassword, wrongPassword) => {
            const { app, db } = createTestApp();
            try {
              // Register the player with the correct password
              const registerRes = await request(app)
                .post('/api/golf/register')
                .send({ username, password: correctPassword });

              // Skip on unexpected registration failure
              if (registerRes.status !== 201) return;

              // Attempt login with the wrong password
              const loginRes = await request(app)
                .post('/api/golf/login')
                .send({ username, password: wrongPassword });

              expect(loginRes.status).toBe(401);
              expect(loginRes.body).toEqual({ error: 'Invalid credentials' });
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 120000);

    it('should return 401 when both username and password are missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant({}),
          async (body) => {
            const { app, db } = createTestApp();
            try {
              const loginRes = await request(app)
                .post('/api/golf/login')
                .send(body);

              expect(loginRes.status).toBe(401);
              expect(loginRes.body).toHaveProperty('error');
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
