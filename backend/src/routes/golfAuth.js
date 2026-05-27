const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const golfDb = require('../db/golfDatabase');
const { JWT_SECRET } = require('../middleware/golfAuth');

const router = express.Router();

const LEAGUE_MAX_PLAYERS = 50;

// Avatar upload setup
const AVATAR_DIR = path.join(__dirname, '../../data/avatars');
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar-${req.user.id}${ext}`);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

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
    const maxSetting = golfDb.prepare("SELECT value FROM league_settings WHERE key = 'max_players'").get();
    const maxPlayers = maxSetting ? parseInt(maxSetting.value, 10) : 50;
    const playerCount = golfDb.prepare('SELECT COUNT(*) AS count FROM players WHERE role = ? AND (archived IS NULL OR archived = 0)').get('player');
    if (playerCount.count >= maxPlayers) {
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
      "INSERT INTO players (username, password_hash, first_name, last_name, email, phone, role, pending_approval) VALUES (?, ?, ?, ?, ?, ?, 'player', 1)"
    ).run(username.trim(), passwordHash, first_name.trim(), last_name.trim(), email.trim().toLowerCase(), phone.trim());

    // Notify admin
    golfDb.prepare(
      'INSERT INTO messages (player_id, subject, body) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, 'New Registration Request', `${first_name.trim()} ${last_name.trim()} (${username.trim()}) has requested to join the league. Please approve or deny from the Admin > Players tab.`);

    return res.status(201).json({
      id: result.lastInsertRowid,
      username: username.trim(),
      pending: true
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
      'SELECT id, username, password_hash, role, force_password_reset, pending_approval FROM players WHERE username = ?'
    ).get(username);

    if (!player) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Block pending accounts
    if (player.pending_approval === 1) {
      return res.status(403).json({ error: 'Your account is pending admin approval. Please check back later.' });
    }

    // Verify password
    const valid = bcrypt.compareSync(password, player.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT with 24h expiry
    const token = jwt.sign(
      { id: player.id, role: player.role, username: player.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      id: player.id,
      username: player.username,
      role: player.role,
      force_password_reset: player.force_password_reset === 1
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/request-reset
 * Public endpoint: submit a password reset request (creates a message for admin).
 */
router.post('/request-reset', (req, res) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length < 1) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const player = golfDb.prepare('SELECT id, username FROM players WHERE username = ?').get(username.trim());
    if (!player) {
      // Don't reveal if user exists — just say request submitted
      return res.json({ message: 'If that account exists, the admin has been notified.' });
    }

    // Create a message in the admin messages table
    golfDb.prepare(
      'INSERT INTO messages (player_id, subject, body) VALUES (?, ?, ?)'
    ).run(player.id, 'Password Reset Request', `Player "${player.username}" has requested a password reset. Please use the admin panel to reset their password.`);

    return res.json({ message: 'If that account exists, the admin has been notified.' });
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
    const player = golfDb.prepare(`
      SELECT p.id, p.username, p.first_name, p.last_name, p.email, p.phone, p.role, p.avatar, p.created_at,
             h.handicap_index
      FROM players p
      LEFT JOIN handicaps h ON p.id = h.player_id
      WHERE p.id = ?
    `).get(req.user.id);
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

/**
 * GET /api/golf/notifications
 * Get the authenticated user's unread notifications.
 */
router.get('/notifications', authMiddleware, (req, res) => {
  try {
    const notifications = golfDb.prepare(
      'SELECT id, subject, body, read, created_at FROM notifications WHERE player_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(req.user.id);
    return res.json(notifications);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/notifications/unread-count
 * Count of unread notifications for the authenticated user.
 */
router.get('/notifications/unread-count', authMiddleware, (req, res) => {
  try {
    const result = golfDb.prepare(
      'SELECT COUNT(*) AS count FROM notifications WHERE player_id = ? AND read = 0'
    ).get(req.user.id);
    return res.json({ count: result.count });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/notifications/:id/read
 * Mark a notification as read.
 */
router.post('/notifications/:id/read', authMiddleware, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    golfDb.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND player_id = ?').run(id, req.user.id);
    return res.json({ message: 'Marked as read' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/golf/notifications/:id
 * Delete a notification (only the owner can delete their own).
 */
router.delete('/notifications/:id', authMiddleware, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    golfDb.prepare('DELETE FROM notifications WHERE id = ? AND player_id = ?').run(id, req.user.id);
    return res.json({ message: 'Notification deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/golf/profile/password
 * Change the authenticated user's password. Requires current password.
 */
router.put('/profile/password', authMiddleware, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (typeof new_password !== 'string' || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const player = golfDb.prepare('SELECT id, password_hash FROM players WHERE id = ?').get(req.user.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const valid = bcrypt.compareSync(current_password, player.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    golfDb.prepare('UPDATE players SET password_hash = ?, force_password_reset = 0 WHERE id = ?').run(newHash, req.user.id);

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/messages
 * Send a message to the admin.
 */
router.post('/messages', authMiddleware, (req, res) => {
  try {
    const { subject, body } = req.body;
    if (!subject || typeof subject !== 'string' || subject.trim().length < 1) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!body || typeof body !== 'string' || body.trim().length < 1) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    golfDb.prepare(
      'INSERT INTO messages (player_id, subject, body) VALUES (?, ?, ?)'
    ).run(req.user.id, subject.trim(), body.trim());

    return res.status(201).json({ message: 'Message sent to admin' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/profile/avatar
 * Upload an avatar image for the authenticated user.
 */
router.post('/profile/avatar', authMiddleware, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Avatar upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/api/golf/avatars/${req.file.filename}`;
    golfDb.prepare('UPDATE players SET avatar = ? WHERE id = ?').run(avatarUrl, req.user.id);

    return res.json({ avatar: avatarUrl });
  });
});

/**
 * GET /api/golf/avatars/:filename
 * Serve avatar images.
 */
router.get('/avatars/:filename', (req, res) => {
  const filePath = path.join(AVATAR_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Avatar not found' });
  }
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(filePath);
});

module.exports = router;
