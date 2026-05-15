/**
 * Property-Based Tests for Golf League Registration (Properties 1–4)
 * Feature: golf-league-handicap-tracker
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6
 */
const fc = require('fast-check');
const request = require('supertest');
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Schema SQL for test database
const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'db', 'golfSchema.sql');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

/**
 * Creates a fresh in-memory database and a minimal Express app
 * that replicates the registration route logic using the test db.
 * Each call returns a completely isolated environment.
 */
function createTestApp() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);

  const app = express();
  app.use(express.json());

  const LEAGUE_MAX_PLAYERS = 50;

  app.post('/api/golf/register', (req, res) => {
    try {
      const { username, password } = req.body;

      // Validate username
      if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }

      // Validate password
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check league cap
      const playerCount = db.prepare('SELECT COUNT(*) AS count FROM players').get();
      if (playerCount.count >= LEAGUE_MAX_PLAYERS) {
        return res.status(403).json({ error: 'League is full' });
      }

      // Check duplicate username
      const existing = db.prepare('SELECT id FROM players WHERE username = ?').get(username.trim());
      if (existing) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      // Hash password and insert (cost 4 for speed in tests)
      const passwordHash = bcrypt.hashSync(password, 4);
      const result = db.prepare(
        "INSERT INTO players (username, password_hash, role) VALUES (?, ?, 'player')"
      ).run(username.trim(), passwordHash);

      return res.status(201).json({
        id: result.lastInsertRowid,
        username: username.trim()
      });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Username already exists' });
      }
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

// Invalid usernames: empty, 1-char, 2-char, or whitespace-only
const invalidUsernameArb = fc.oneof(
  fc.constant(''),
  fc.constant('a'),
  fc.constant('ab'),
  fc.constant('   '),
  fc.constant('  '),
  fc.constant(' '),
  fc.stringMatching(/^[a-zA-Z0-9]{1,2}$/)
);

// Invalid passwords: empty or < 6 chars
const invalidPasswordArb = fc.oneof(
  fc.constant(''),
  fc.constant('a'),
  fc.constant('ab'),
  fc.constant('abc'),
  fc.constant('abcd'),
  fc.constant('12345'),
  fc.stringMatching(/^[a-zA-Z0-9]{1,5}$/)
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Feature: golf-league-handicap-tracker', () => {
  /**
   * Property 1: Valid registration creates a player
   * Validates: Requirements 1.2
   *
   * For any valid username (≥3 chars) and valid password (≥6 chars) where the
   * username does not already exist and the league has fewer than 50 members,
   * registering should return HTTP 201 with the player's id and username, and
   * the player should be retrievable from the database.
   */
  describe('Property 1: Valid registration creates a player', () => {
    it('should create a player for any valid username and password', async () => {
      await fc.assert(
        fc.asyncProperty(validUsernameArb, validPasswordArb, async (username, password) => {
          // Fresh isolated db per iteration — no league cap or duplicate concerns
          const { app, db } = createTestApp();
          try {
            const res = await request(app)
              .post('/api/golf/register')
              .send({ username, password });

            // Should return 201
            expect(res.status).toBe(201);

            // Response should contain id and username
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('username');
            expect(res.body.username).toBe(username.trim());
            expect(typeof res.body.id).toBe('number');

            // Player should be retrievable from the database
            const player = db.prepare('SELECT * FROM players WHERE id = ?').get(res.body.id);
            expect(player).toBeDefined();
            expect(player.username).toBe(username.trim());
            expect(player.role).toBe('player');
          } finally {
            db.close();
          }
        }),
        { numRuns: 100 }
      );
    }, 120000);
  });

  /**
   * Property 2: Duplicate username registration is rejected
   * Validates: Requirements 1.3
   *
   * For any valid username, if a player with that username already exists, a
   * subsequent registration attempt with the same username should return HTTP 409
   * regardless of the password provided.
   */
  describe('Property 2: Duplicate username registration is rejected', () => {
    it('should return 409 for duplicate username regardless of password', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArb,
          validPasswordArb,
          validPasswordArb,
          async (username, password1, password2) => {
            // Fresh isolated db per iteration
            const { app, db } = createTestApp();
            try {
              // First registration should succeed
              const res1 = await request(app)
                .post('/api/golf/register')
                .send({ username, password: password1 });

              expect(res1.status).toBe(201);

              // Second registration with same username should fail with 409
              const res2 = await request(app)
                .post('/api/golf/register')
                .send({ username, password: password2 });

              expect(res2.status).toBe(409);
              expect(res2.body).toHaveProperty('error');
              expect(res2.body.error).toMatch(/already exists/i);
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
   * Property 3: Invalid registration input is rejected
   * Validates: Requirements 1.4, 1.5
   *
   * For any username shorter than 3 characters (including empty/missing) or any
   * password shorter than 6 characters (including empty/missing), the registration
   * endpoint should return HTTP 400 and no player record should be created.
   */
  describe('Property 3: Invalid registration input is rejected', () => {
    it('should return 400 for invalid username', async () => {
      // Single shared app is fine here — no successful registrations occur
      const { app, db } = createTestApp();
      try {
        await fc.assert(
          fc.asyncProperty(invalidUsernameArb, validPasswordArb, async (username, password) => {
            const res = await request(app)
              .post('/api/golf/register')
              .send({ username, password });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');

            // No player should be created
            const count = db.prepare('SELECT COUNT(*) AS count FROM players').get();
            expect(count.count).toBe(0);
          }),
          { numRuns: 100 }
        );
      } finally {
        db.close();
      }
    }, 60000);

    it('should return 400 for invalid password', async () => {
      const { app, db } = createTestApp();
      try {
        await fc.assert(
          fc.asyncProperty(validUsernameArb, invalidPasswordArb, async (username, password) => {
            const res = await request(app)
              .post('/api/golf/register')
              .send({ username, password });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');

            // No player should be created
            const count = db.prepare('SELECT COUNT(*) AS count FROM players').get();
            expect(count.count).toBe(0);
          }),
          { numRuns: 100 }
        );
      } finally {
        db.close();
      }
    }, 60000);

    it('should return 400 for missing username field', async () => {
      const { app, db } = createTestApp();
      try {
        await fc.assert(
          fc.asyncProperty(validPasswordArb, async (password) => {
            const res = await request(app)
              .post('/api/golf/register')
              .send({ password });

            expect(res.status).toBe(400);

            const count = db.prepare('SELECT COUNT(*) AS count FROM players').get();
            expect(count.count).toBe(0);
          }),
          { numRuns: 100 }
        );
      } finally {
        db.close();
      }
    }, 60000);

    it('should return 400 for missing password field', async () => {
      const { app, db } = createTestApp();
      try {
        await fc.assert(
          fc.asyncProperty(validUsernameArb, async (username) => {
            const res = await request(app)
              .post('/api/golf/register')
              .send({ username });

            expect(res.status).toBe(400);

            const count = db.prepare('SELECT COUNT(*) AS count FROM players').get();
            expect(count.count).toBe(0);
          }),
          { numRuns: 100 }
        );
      } finally {
        db.close();
      }
    }, 60000);
  });

  /**
   * Property 4: Passwords are never stored in plain text
   * Validates: Requirements 1.6
   *
   * For any registered player, the stored password_hash value in the database
   * should be a valid bcrypt hash and should never equal the original plain-text password.
   */
  describe('Property 4: Passwords are never stored in plain text', () => {
    it('should store password as bcrypt hash, never as plain text', async () => {
      await fc.assert(
        fc.asyncProperty(validUsernameArb, validPasswordArb, async (username, password) => {
          // Fresh isolated db per iteration
          const { app, db } = createTestApp();
          try {
            const res = await request(app)
              .post('/api/golf/register')
              .send({ username, password });

            expect(res.status).toBe(201);

            // Retrieve the stored player
            const player = db.prepare('SELECT password_hash FROM players WHERE id = ?').get(res.body.id);
            expect(player).toBeDefined();

            // Password hash should never equal the plain text password
            expect(player.password_hash).not.toBe(password);

            // Password hash should be a valid bcrypt hash (starts with $2a$, $2b$, or $2y$)
            expect(player.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);

            // Verify the hash actually matches the original password
            const isValid = bcrypt.compareSync(password, player.password_hash);
            expect(isValid).toBe(true);
          } finally {
            db.close();
          }
        }),
        { numRuns: 100 }
      );
    }, 120000);
  });
});
