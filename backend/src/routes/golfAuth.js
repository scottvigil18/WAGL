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
    const { username, password, email, phone, first_name, last_name } = req.body;

    // Validate first name
    if (!first_name || typeof first_name !== 'string' || first_name.trim().length < 1) {
      return res.status(400).json({ error: 'First name is required' });
    }

    // Validate last name
    if (!last_name || typeof last_name !== 'string' || last_name.trim().length < 1) {
      return res.status(400).json({ error: 'Last name is required' });
    }

    // Validate username
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    // Validate password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate email
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    // Validate phone (must be xxx-xxx-xxxx format)
    if (!phone || typeof phone !== 'string' || !/^\d{3}-\d{3}-\d{4}$/.test(phone.trim())) {
      return res.status(400).json({ error: 'Phone number must be in xxx-xxx-xxxx format' });
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
      "INSERT INTO players (username, password_hash, first_name, last_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?, 'player')"
    ).run(username.trim(), passwordHash, first_name.trim(), last_name.trim(), email.trim().toLowerCase(), phone.trim());

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

const { authMiddleware } = require('../middleware/golfAuth');

/**
 * GET /api/golf/check-username?username=xxx
 * Public endpoint: check if a username is available.
 */
router.get('/check-username', (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.trim().length < 3) {
      return res.json({ available: false, error: 'Username must be at least 3 characters' });
    }
    const existing = golfDb.prepare('SELECT id FROM players WHERE username = ?').get(username.trim());
    return res.json({ available: !existing });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/profile
 * Get the authenticated user's profile.
 */
router.get('/profile', authMiddleware, (req, res) => {
  try {
    const player = golfDb.prepare(
      'SELECT id, username, first_name, last_name, email, phone, role, created_at FROM players WHERE id = ?'
    ).get(req.user.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    return res.json(player);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/golf/profile
 * Update the authenticated user's own profile (first_name, last_name, username, email, phone).
 */
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const playerId = req.user.id;
    const player = golfDb.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const { first_name, last_name, username, email, phone } = req.body;

    // Validate first_name
    if (first_name !== undefined && (!first_name || first_name.trim().length < 1)) {
      return res.status(400).json({ error: 'First name is required' });
    }
    // Validate last_name
    if (last_name !== undefined && (!last_name || last_name.trim().length < 1)) {
      return res.status(400).json({ error: 'Last name is required' });
    }
    // Validate username
    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      const conflict = golfDb.prepare('SELECT id FROM players WHERE username = ? AND id != ?').get(username.trim(), playerId);
      if (conflict) return res.status(409).json({ error: 'Username already taken' });
    }
    // Validate email
    if (email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim())) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
    }
    // Validate phone
    if (phone !== undefined && phone.trim() && !/^\d{3}-\d{3}-\d{4}$/.test(phone.trim())) {
      return res.status(400).json({ error: 'Phone number must be in xxx-xxx-xxxx format' });
    }

    const newFirstName = first_name !== undefined ? first_name.trim() : player.first_name;
    const newLastName  = last_name !== undefined ? last_name.trim() : player.last_name;
    const newUsername  = username !== undefined ? username.trim() : player.username;
    const newEmail     = email !== undefined ? email.trim().toLowerCase() : player.email;
    const newPhone     = phone !== undefined ? phone.trim() : player.phone;

    golfDb.prepare(
      'UPDATE players SET first_name = ?, last_name = ?, username = ?, email = ?, phone = ? WHERE id = ?'
    ).run(newFirstName, newLastName, newUsername, newEmail, newPhone, playerId);

    const updated = golfDb.prepare(
      'SELECT id, username, first_name, last_name, email, phone, role, created_at FROM players WHERE id = ?'
    ).get(playerId);

    return res.json(updated);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
