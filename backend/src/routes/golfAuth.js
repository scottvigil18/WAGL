const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const golfDb = require('../db/golfDatabase');
const { JWT_SECRET } = require('../middleware/golfAuth');

const router = express.Router();

const LEAGUE_MAX_PLAYERS = 50;

/**
 * POST /api/golf/register
 * Register a new player in the golf league.
 */
router.post('/register', (req, res) => {
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
    const playerCount = golfDb.prepare('SELECT COUNT(*) AS count FROM players').get();
    if (playerCount.count >= LEAGUE_MAX_PLAYERS) {
      return res.status(403).json({ error: 'League is full' });
    }

    // Check duplicate username
    const existing = golfDb.prepare('SELECT id FROM players WHERE username = ?').get(username.trim());
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password and insert
    const passwordHash = bcrypt.hashSync(password, 10);
    const result = golfDb.prepare(
      "INSERT INTO players (username, password_hash, role) VALUES (?, ?, 'player')"
    ).run(username.trim(), passwordHash);

    return res.status(201).json({
      id: result.lastInsertRowid,
      username: username.trim()
    });
  } catch (err) {
    // Handle unique constraint violation (race condition)
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/login
 * Authenticate a player and return a JWT.
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Find user
    const player = golfDb.prepare(
      'SELECT id, username, password_hash, role FROM players WHERE username = ?'
    ).get(username);

    if (!player) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const valid = bcrypt.compareSync(password, player.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT with 24h expiry
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

module.exports = router;
