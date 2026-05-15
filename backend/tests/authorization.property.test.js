/**
 * Property-Based Tests for Authorization (Properties 7–8)
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
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const { JWT_SECRET } = require('../src/middleware/golfAuth');

// ─── Test App Setup ───────────────────────────────────────────────────────────

/**
 * Creates a fresh Express app with an in-memory SQLite database for test isolation.
 */
function createTestApp() {
  // Create in-memory database
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Apply schema
  const schemaPath = path.join(__dirname, '..', 'src', 'db', 'golfSchema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Seed a player and an admin for testing
  const bcrypt = require('bcryptjs');
  const playerHash = bcrypt.hashSync('password123', 10);
  const adminHash = bcrypt.hashSync('adminpass123', 10);

  db.prepare(
    "INSERT INTO players (username, password_hash, role) VALUES (?, ?, 'player')"
  ).run('testplayer', playerHash);

  db.prepare(
    "INSERT INTO players (username, password_hash, role) VALUES (?, ?, 'admin')"
  ).run('testadmin', adminHash);

  // Create Express app with the test database injected
  const app = express();
  app.use(express.json());

  // Override the golfDatabase module to use our in-memory db
  // We need to create route handlers that use our test db
  const { authMiddleware, adminMiddleware } = require('../src/middleware/golfAuth');

  // POST /api/golf/scores — protected (player/admin)
  app.post('/api/golf/scores', authMiddleware, (req, res) => {
    const { score, date_played } = req.body;
    const playerId = req.user.id;

    if (!score || !Number.isInteger(score) || score < 50 || score > 150) {
      return res.status(400).json({ error: 'Score must be an integer between 50 and 150' });
    }

    if (!date_played) {
      return res.status(400).json({ error: 'date_played is required' });
    }

    try {
      const result = db.prepare(
        'INSERT INTO scores (player_id, score, date_played) VALUES (?, ?, ?)'
      ).run(playerId, score, date_played);

      const created = db.prepare('SELECT * FROM scores WHERE id = ?').get(result.lastInsertRowid);
      return res.status(201).json(created);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Score already submitted for this date' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/golf/scores/:id — admin only
  app.put('/api/golf/scores/:id', authMiddleware, adminMiddleware, (req, res) => {
    const scoreId = parseInt(req.params.id, 10);
    if (isNaN(scoreId)) {
      return res.status(400).json({ error: 'Invalid score ID' });
    }

    const existing = db.prepare('SELECT * FROM scores WHERE id = ?').get(scoreId);
    if (!existing) {
      return res.status(404).json({ error: 'Score not found' });
    }

    const { score, date_played } = req.body;
    const newScore = score !== undefined ? score : existing.score;
    const newDate = date_played !== undefined ? date_played : existing.date_played;

    db.prepare('UPDATE scores SET score = ?, date_played = ? WHERE id = ?').run(newScore, newDate, scoreId);
    const updated = db.prepare('SELECT * FROM scores WHERE id = ?').get(scoreId);
    return res.status(200).json(updated);
  });

  // GET /api/golf/scores/me — protected (player/admin)
  app.get('/api/golf/scores/me', authMiddleware, (req, res) => {
    const playerId = req.user.id;
    const scores = db.prepare(
      'SELECT id, score, date_played, created_at FROM scores WHERE player_id = ? ORDER BY date_played DESC'
    ).all(playerId);
    return res.status(200).json(scores);
  });

  return { app, db };
}

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Generates random invalid/missing Authorization header values.
 */
const invalidAuthHeaders = fc.oneof(
  // No Authorization header at all
  fc.constant(undefined),
  // Empty string
  fc.constant(''),
  // Missing "Bearer " prefix
  fc.string({ minLength: 1, maxLength: 100 }).map(s => s.replace(/^Bearer /i, 'Token ')),
  // "Bearer " with garbage token
  fc.string({ minLength: 1, maxLength: 200 }).map(s => `Bearer ${s.replace(/\./g, 'x')}`),
  // "Bearer " with empty token
  fc.constant('Bearer '),
  // Expired JWT
  fc.constant(
    jwt.sign({ id: 1, role: 'player' }, JWT_SECRET, { expiresIn: '-1h' })
  ).map(token => `Bearer ${token}`),
  // JWT signed with wrong secret
  fc.constant(
    jwt.sign({ id: 1, role: 'player' }, 'wrong-secret-key', { expiresIn: '24h' })
  ).map(token => `Bearer ${token}`)
);

/**
 * Generates a protected endpoint configuration (method + path).
 */
const protectedEndpoints = fc.constantFrom(
  { method: 'post', path: '/api/golf/scores' },
  { method: 'put', path: '/api/golf/scores/1' },
  { method: 'get', path: '/api/golf/scores/me' }
);

/**
 * Generates arbitrary request body content for admin endpoint tests.
 */
const arbitraryRequestBody = fc.oneof(
  fc.constant({}),
  fc.record({
    score: fc.integer({ min: 50, max: 150 }),
    date_played: fc.constant('2024-06-15')
  }),
  fc.record({
    score: fc.integer({ min: -1000, max: 1000 }),
    date_played: fc.string()
  }),
  fc.jsonValue().filter(v => typeof v === 'object' && v !== null && !Array.isArray(v))
);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Feature: golf-league-handicap-tracker', () => {
  let app;
  let db;

  beforeAll(() => {
    const testSetup = createTestApp();
    app = testSetup.app;
    db = testSetup.db;
  });

  afterAll(() => {
    if (db) db.close();
  });

  describe('Property 7: Protected endpoints reject unauthenticated requests', () => {
    /**
     * Validates: Requirements 3.2, 3.3
     *
     * For any protected endpoint (POST /api/golf/scores, PUT /api/golf/scores/:id,
     * GET /api/golf/scores/me), a request without a valid JWT in the Authorization
     * header should return HTTP 401.
     */
    it('should return 401 for any protected endpoint when no valid JWT is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          protectedEndpoints,
          invalidAuthHeaders,
          async (endpoint, authHeader) => {
            const req = request(app)[endpoint.method](endpoint.path);

            if (authHeader !== undefined) {
              req.set('Authorization', authHeader);
            }

            // For POST/PUT, send a body
            if (endpoint.method === 'post' || endpoint.method === 'put') {
              req.set('Content-Type', 'application/json');
              req.send({ score: 85, date_played: '2024-01-15' });
            }

            const res = await req;

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Authentication required');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Player role cannot access admin endpoints', () => {
    /**
     * Validates: Requirements 3.4, 5.3
     *
     * For any authenticated user with role "player", a request to an admin-only
     * endpoint (PUT /api/golf/scores/:id) should return HTTP 403 regardless of
     * the request body content.
     */
    it('should return 403 for player role accessing admin-only PUT /api/golf/scores/:id', async () => {
      // First, insert a score so we have a valid score ID to target
      db.prepare(
        "INSERT OR IGNORE INTO scores (player_id, score, date_played) VALUES (1, 85, '2024-01-01')"
      ).run();

      await fc.assert(
        fc.asyncProperty(
          arbitraryRequestBody,
          fc.integer({ min: 1, max: 1000 }),
          async (body, scoreId) => {
            // Generate a valid player JWT
            const playerToken = jwt.sign(
              { id: 1, role: 'player' },
              JWT_SECRET,
              { expiresIn: '24h' }
            );

            const res = await request(app)
              .put(`/api/golf/scores/${scoreId}`)
              .set('Authorization', `Bearer ${playerToken}`)
              .set('Content-Type', 'application/json')
              .send(body);

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'Admin access required');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
