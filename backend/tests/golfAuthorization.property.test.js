/**
 * Property-Based Tests for Golf League Authorization (Properties 7–8)
 * Feature: golf-league-handicap-tracker
 *
 * Property 7: Protected endpoints reject unauthenticated requests
 * Property 8: Player role cannot access admin endpoints
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 5.3
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
 * replicates the register, login, and score route logic needed for authorization
 * testing.
 *
 * Each call returns a completely isolated { app, db } pair.
 * Using bcrypt cost factor 4 for speed in tests (vs 10 in production).
 */
function createTestApp() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);

  const app = express();
  app.use(express.json());

  // ── Auth middleware (mirrors golfAuth.js) ────────────────────────────────
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
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.id, role: decoded.role };
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Authentication required' });
    }
  }

  function adminMiddleware(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  }

  // ── POST /api/golf/register ──────────────────────────────────────────────
  app.post('/api/golf/register', (req, res) => {
    try {
      const { username, password, role } = req.body;

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

      // Allow role override for test setup (admin seeding)
      const assignedRole = role === 'admin' ? 'admin' : 'player';
      const passwordHash = bcrypt.hashSync(password, 4);
      const result = db.prepare(
        'INSERT INTO players (username, password_hash, role) VALUES (?, ?, ?)'
      ).run(username.trim(), passwordHash, assignedRole);

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

  // ── POST /api/golf/scores (protected: any authenticated user) ────────────
  app.post('/api/golf/scores', authMiddleware, (req, res) => {
    // Minimal handler — auth check is what we're testing
    return res.status(201).json({ id: 1, score: req.body.score, date_played: req.body.date_played });
  });

  // ── PUT /api/golf/scores/:id (protected: admin only) ─────────────────────
  app.put('/api/golf/scores/:id', authMiddleware, adminMiddleware, (req, res) => {
    // Minimal handler — auth/admin check is what we're testing
    return res.status(200).json({ id: parseInt(req.params.id, 10) });
  });

  // ── GET /api/golf/scores/me (protected: any authenticated user) ──────────
  app.get('/api/golf/scores/me', authMiddleware, (req, res) => {
    // Minimal handler — auth check is what we're testing
    return res.status(200).json([]);
  });

  return { app, db };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Registers a player and logs in, returning the JWT token.
 * Uses bcrypt cost 4 for speed.
 */
async function registerAndLogin(app, username, password, role = 'player') {
  const regRes = await request(app)
    .post('/api/golf/register')
    .send({ username, password, role });
  if (regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
  }
  const loginRes = await request(app)
    .post('/api/golf/login')
    .send({ username, password });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }
  return loginRes.body.token;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

// Valid username: 3–12 alphanumeric/underscore characters
const validUsernameArb = fc.stringMatching(/^[a-zA-Z0-9_]{3,12}$/);

// Valid password: 6–20 printable ASCII characters
const validPasswordArb = fc.stringMatching(/^[a-zA-Z0-9!@#$%^&*()_+\-=]{6,20}$/);

// Arbitrary score body (content doesn't matter for auth tests)
const scoreBodyArb = fc.record({
  score: fc.integer({ min: 50, max: 150 }),
  date_played: fc.constantFrom(
    '2024-01-15', '2024-03-22', '2024-06-10',
    '2024-08-05', '2024-11-30', '2025-01-01'
  )
});

// Arbitrary score ID (positive integer)
const scoreIdArb = fc.integer({ min: 1, max: 9999 });

// Malformed / invalid Authorization header values
const malformedAuthHeaderArb = fc.oneof(
  // No "Bearer " prefix
  fc.constant('not-a-bearer-token'),
  fc.constant('Basic dXNlcjpwYXNz'),
  fc.constant('Token abc123'),
  // "Bearer " prefix but garbage token
  fc.constant('Bearer '),
  fc.constant('Bearer not.a.jwt'),
  fc.constant('Bearer eyJhbGciOiJIUzI1NiJ9.garbage.signature'),
  // Signed with wrong secret
  fc.constant('Bearer ' + jwt.sign({ id: 1, role: 'player' }, 'wrong-secret', { expiresIn: '1h' })),
  // Expired token (signed with correct secret but exp in the past)
  fc.constant('Bearer ' + jwt.sign({ id: 1, role: 'player' }, JWT_SECRET, { expiresIn: '-1s' }))
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Feature: golf-league-handicap-tracker', () => {
  /**
   * Property 7: Protected endpoints reject unauthenticated requests
   * Validates: Requirements 3.2, 3.3
   *
   * For any protected endpoint (POST /api/golf/scores, PUT /api/golf/scores/:id,
   * GET /api/golf/scores/me), a request without a valid JWT in the Authorization
   * header should return HTTP 401.
   */
  describe('Property 7: Protected endpoints reject unauthenticated requests', () => {
    it('POST /api/golf/scores — should return 401 with no Authorization header', async () => {
      await fc.assert(
        fc.asyncProperty(scoreBodyArb, async (body) => {
          const { app, db } = createTestApp();
          try {
            const res = await request(app)
              .post('/api/golf/scores')
              .send(body);
            // No Authorization header at all
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toMatch(/authentication required/i);
          } finally {
            db.close();
          }
        }),
        { numRuns: 100 }
      );
    }, 60000);

    it('POST /api/golf/scores — should return 401 with malformed/invalid token', async () => {
      await fc.assert(
        fc.asyncProperty(scoreBodyArb, malformedAuthHeaderArb, async (body, authHeader) => {
          const { app, db } = createTestApp();
          try {
            const res = await request(app)
              .post('/api/golf/scores')
              .set('Authorization', authHeader)
              .send(body);
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toMatch(/authentication required/i);
          } finally {
            db.close();
          }
        }),
        { numRuns: 100 }
      );
    }, 60000);

    it('PUT /api/golf/scores/:id — should return 401 with no Authorization header', async () => {
      await fc.assert(
        fc.asyncProperty(scoreIdArb, scoreBodyArb, async (id, body) => {
          const { app, db } = createTestApp();
          try {
            const res = await request(app)
              .put(`/api/golf/scores/${id}`)
              .send(body);
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toMatch(/authentication required/i);
          } finally {
            db.close();
          }
        }),
        { numRuns: 100 }
      );
    }, 60000);

    it('PUT /api/golf/scores/:id — should return 401 with malformed/invalid token', async () => {
      await fc.assert(
        fc.asyncProperty(scoreIdArb, scoreBodyArb, malformedAuthHeaderArb, async (id, body, authHeader) => {
          const { app, db } = createTestApp();
          try {
            const res = await request(app)
              .put(`/api/golf/scores/${id}`)
              .set('Authorization', authHeader)
              .send(body);
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toMatch(/authentication required/i);
          } finally {
            db.close();
          }
        }),
        { numRuns: 100 }
      );
    }, 60000);

    it('GET /api/golf/scores/me — should return 401 with no Authorization header', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const { app, db } = createTestApp();
          try {
            const res = await request(app)
              .get('/api/golf/scores/me');
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toMatch(/authentication required/i);
          } finally {
            db.close();
          }
        }),
        { numRuns: 100 }
      );
    }, 60000);

    it('GET /api/golf/scores/me — should return 401 with malformed/invalid token', async () => {
      await fc.assert(
        fc.asyncProperty(malformedAuthHeaderArb, async (authHeader) => {
          const { app, db } = createTestApp();
          try {
            const res = await request(app)
              .get('/api/golf/scores/me')
              .set('Authorization', authHeader);
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toMatch(/authentication required/i);
          } finally {
            db.close();
          }
        }),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Property 8: Player role cannot access admin endpoints
   * Validates: Requirements 3.4, 5.3
   *
   * For any authenticated user with role "player", a request to an admin-only
   * endpoint (PUT /api/golf/scores/:id) should return HTTP 403 regardless of
   * the request body content.
   */
  describe('Property 8: Player role cannot access admin endpoints', () => {
    it('PUT /api/golf/scores/:id — should return 403 for any player-role JWT regardless of body', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          scoreIdArb,
          scoreBodyArb,
          async (username, password, scoreId, body) => {
            const { app, db } = createTestApp();
            try {
              // Register and log in as a player
              const token = await registerAndLogin(app, username, password, 'player');

              // Attempt to PUT an admin-only endpoint with a valid player JWT
              const res = await request(app)
                .put(`/api/golf/scores/${scoreId}`)
                .set('Authorization', `Bearer ${token}`)
                .send(body);

              // Must be 403, not 401 (token is valid) and not 200 (not admin)
              expect(res.status).toBe(403);
              expect(res.body).toHaveProperty('error');
              expect(res.body.error).toMatch(/admin access required/i);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 120000);

    it('PUT /api/golf/scores/:id — player is rejected even with arbitrary JSON body content', async () => {
      // Extra coverage: vary the body shape to confirm body content is irrelevant
      const arbitraryBodyArb = fc.oneof(
        fc.constant({}),
        fc.constant({ score: 72 }),
        fc.constant({ score: 150, date_played: '2024-12-31' }),
        fc.constant({ score: 50, date_played: '2024-01-01', holes: 18 }),
        fc.record({
          score: fc.integer({ min: 50, max: 150 }),
          date_played: fc.constantFrom('2024-05-01', '2024-07-04', '2024-09-15'),
          extra: fc.string()
        })
      );

      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          scoreIdArb,
          arbitraryBodyArb,
          async (username, password, scoreId, body) => {
            const { app, db } = createTestApp();
            try {
              const token = await registerAndLogin(app, username, password, 'player');

              const res = await request(app)
                .put(`/api/golf/scores/${scoreId}`)
                .set('Authorization', `Bearer ${token}`)
                .send(body);

              expect(res.status).toBe(403);
              expect(res.body).toHaveProperty('error');
              expect(res.body.error).toMatch(/admin access required/i);
            } finally {
              db.close();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 120000);
  });
});
