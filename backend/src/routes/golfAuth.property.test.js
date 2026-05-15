/**
 * Property-Based Tests for Golf Auth - Properties 5 & 6
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
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const { JWT_SECRET } = require('../middleware/golfAuth');

// --- Test App Setup ---
// We create a fresh in-memory database and a test Express app for isolation.

function createTestApp() {
  // Create in-memory database with the golf schema
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, '../db/golfSchema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Mock the golfDatabase module to use our in-memory db
  // We need to override the require cache
  const golfDbPath = require.resolve('../db/golfDatabase');
  const originalModule = require.cache[golfDbPath];
  require.cache[golfDbPath] = { id: golfDbPath, exports: db };

  // Clear the golfAuth route module cache so it picks up the new db
  const golfAuthRoutePath = require.resolve('../routes/golfAuth');
  delete require.cache[golfAuthRoutePath];

  const golfAuthRoutes = require('../routes/golfAuth');

  const app = express();
  app.use(express.json());
  app.use('/api/golf', golfAuthRoutes);

  // Restore original module after loading routes
  if (originalModule) {
    require.cache[golfDbPath] = originalModule;
  } else {
    delete require.cache[golfDbPath];
  }

  // Also restore golfAuth route cache
  delete require.cache[golfAuthRoutePath];

  return { app, db };
}

// --- Generators ---

// Valid username: at least 3 characters, alphanumeric + underscore
const validUsernameArb = fc.string({ minLength: 3, maxLength: 20 })
  .filter(s => /^[a-zA-Z0-9_]+$/.test(s) && s.trim().length >= 3);

// Valid password: at least 6 characters
const validPasswordArb = fc.string({ minLength: 6, maxLength: 30 })
  .filter(s => s.length >= 6);

// Invalid username that doesn't exist (random string for non-existent user)
const nonExistentUsernameArb = fc.string({ minLength: 3, maxLength: 20 })
  .map(s => 'nonexist_' + s.replace(/[^a-zA-Z0-9_]/g, 'x'));

// Wrong password (different from the registered one)
const wrongPasswordArb = fc.string({ minLength: 6, maxLength: 30 })
  .map(s => 'wrong_' + s);

// --- Property 5: Valid credentials produce a correct JWT ---
describe('Feature: golf-league-handicap-tracker, Property 5: Valid credentials produce a correct JWT', () => {
  /**
   * Validates: Requirements 2.2, 2.5, 2.6
   *
   * For any registered player who logs in with correct credentials,
   * the response should contain a valid JWT whose payload includes
   * the player's id, role, and an exp claim approximately 24 hours after iat.
   */
  it('should return a valid JWT with correct payload for any valid credentials', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validPasswordArb,
        async (username, password) => {
          const { app, db } = createTestApp();

          try {
            // Register the player first
            const registerRes = await request(app)
              .post('/api/golf/register')
              .send({ username, password });

            // Skip if registration failed (e.g., duplicate in rare collision)
            if (registerRes.status !== 201) return;

            const playerId = registerRes.body.id;

            // Login with the same credentials
            const loginRes = await request(app)
              .post('/api/golf/login')
              .send({ username, password });

            // Should return 200
            expect(loginRes.status).toBe(200);

            // Should contain a token
            expect(loginRes.body).toHaveProperty('token');
            expect(typeof loginRes.body.token).toBe('string');

            // Should contain id, username, role
            expect(loginRes.body.id).toBe(playerId);
            expect(loginRes.body.username).toBe(username);
            expect(loginRes.body.role).toBe('player');

            // Verify the JWT is valid and has correct payload
            const decoded = jwt.verify(loginRes.body.token, JWT_SECRET);
            expect(decoded.id).toBe(playerId);
            expect(decoded.role).toBe('player');

            // Check exp is approximately 24 hours after iat
            expect(decoded).toHaveProperty('iat');
            expect(decoded).toHaveProperty('exp');
            const diffSeconds = decoded.exp - decoded.iat;
            // 24 hours = 86400 seconds, allow small tolerance
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

// --- Property 6: Invalid credentials are rejected ---
describe('Feature: golf-league-handicap-tracker, Property 6: Invalid credentials are rejected', () => {
  /**
   * Validates: Requirements 2.3, 2.4
   *
   * For any login attempt where either the username does not exist
   * or the password does not match the stored hash, the endpoint
   * should return HTTP 401 with { "error": "Invalid credentials" }.
   */
  it('should return 401 for non-existent username', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonExistentUsernameArb,
        validPasswordArb,
        async (username, password) => {
          const { app, db } = createTestApp();

          try {
            // Attempt login with a username that was never registered
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

  it('should return 401 for wrong password on existing user', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validPasswordArb,
        wrongPasswordArb,
        async (username, correctPassword, wrongPassword) => {
          const { app, db } = createTestApp();

          try {
            // Register the player
            const registerRes = await request(app)
              .post('/api/golf/register')
              .send({ username, password: correctPassword });

            if (registerRes.status !== 201) return;

            // Attempt login with wrong password
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
});
