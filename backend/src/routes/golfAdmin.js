const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const golfDb = require('../db/golfDatabase');
const { authMiddleware, adminMiddleware } = require('../middleware/golfAuth');
const { calculateHandicap } = require('../services/handicapClient');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

const DEFAULT_COURSE_RATING = 72.0;
const DEFAULT_SLOPE_RATING = 113;

function isValidScore(value) {
  return Number.isInteger(value) && value > 0;
}

function isValidHoles(value) {
  return value === 9 || value === 18;
}

function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

async function recalculateHandicap(playerId) {
  const rows = golfDb.prepare(
    `SELECT s.score, c.course_rating, c.slope_rating
     FROM scores s
     LEFT JOIN courses c ON s.course_id = c.id
     WHERE s.player_id = ?
     ORDER BY s.date_played DESC`
  ).all(playerId);

  if (rows.length === 0) {
    golfDb.prepare('DELETE FROM handicaps WHERE player_id = ?').run(playerId);
    return;
  }

  const scores = rows.map(r => r.score);
  const courseRating = rows[0].course_rating || DEFAULT_COURSE_RATING;
  const slopeRating = rows[0].slope_rating || DEFAULT_SLOPE_RATING;

  const result = await calculateHandicap(scores, courseRating, slopeRating);

  const existing = golfDb.prepare('SELECT id FROM handicaps WHERE player_id = ?').get(playerId);
  if (existing) {
    golfDb.prepare(
      "UPDATE handicaps SET handicap_index = ?, updated_at = datetime('now') WHERE player_id = ?"
    ).run(result.handicap_index, playerId);
  } else {
    golfDb.prepare(
      'INSERT INTO handicaps (player_id, handicap_index) VALUES (?, ?)'
    ).run(playerId, result.handicap_index);
  }
  return result;
}

// ─── Players ──────────────────────────────────────────────────────────────────

/**
 * GET /api/golf/admin/players
 * List all players (active and archived) with their handicap index.
 */
router.get('/players', (req, res) => {
  try {
    const players = golfDb.prepare(`
      SELECT p.id, p.username, p.first_name, p.last_name, p.email, p.phone, p.role, p.archived, p.pending_approval, p.created_at,
             h.handicap_index,
             COUNT(s.id) AS score_count
      FROM players p
      LEFT JOIN handicaps h ON p.id = h.player_id
      LEFT JOIN scores s ON p.id = s.player_id
      GROUP BY p.id
      ORDER BY p.pending_approval DESC, p.archived ASC, p.last_name ASC, p.first_name ASC
    `).all();
    return res.json(players);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/golf/admin/players/:id
 * Update a player's profile (first_name, last_name, username, email, phone, role).
 */
router.put('/players/:id', (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    const player = golfDb.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const { first_name, last_name, username, email, phone, role, password } = req.body;

    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      const conflict = golfDb.prepare('SELECT id FROM players WHERE username = ? AND id != ?').get(username.trim(), playerId);
      if (conflict) return res.status(409).json({ error: 'Username already taken' });
    }
    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim())) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (phone !== undefined && phone.trim() && !/^\d{3}-\d{3}-\d{4}$/.test(phone.trim())) {
      return res.status(400).json({ error: 'Phone number must be in xxx-xxx-xxxx format' });
    }
    if (role !== undefined && !['player', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be player or admin' });
    }
    if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const newFirstName = first_name !== undefined ? first_name.trim() : (player.first_name || '');
    const newLastName  = last_name !== undefined ? last_name.trim() : (player.last_name || '');
    const newUsername  = username !== undefined ? username.trim() : player.username;
    const newEmail     = email !== undefined ? email.trim().toLowerCase() : player.email;
    const newPhone     = phone !== undefined ? phone.trim() : player.phone;
    const newRole      = role !== undefined ? role : player.role;
    const newHash      = password !== undefined ? bcrypt.hashSync(password, 10) : player.password_hash;

    golfDb.prepare(
      'UPDATE players SET first_name = ?, last_name = ?, username = ?, email = ?, phone = ?, role = ?, password_hash = ? WHERE id = ?'
    ).run(newFirstName, newLastName, newUsername, newEmail, newPhone, newRole, newHash, playerId);

    const updated = golfDb.prepare(
      'SELECT id, username, first_name, last_name, email, phone, role, archived, created_at FROM players WHERE id = ?'
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
 * POST /api/golf/admin/players/:id/archive
 * Archive a player (soft-delete — hides from leaderboard but preserves data).
 */
router.post('/players/:id/archive', (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });
    if (playerId === req.user.id) return res.status(400).json({ error: 'Cannot archive your own account' });

    const player = golfDb.prepare('SELECT id FROM players WHERE id = ?').get(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    golfDb.prepare('UPDATE players SET archived = 1 WHERE id = ?').run(playerId);
    return res.json({ message: 'Player archived' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/admin/players/:id/unarchive
 * Restore an archived player back to active status.
 */
router.post('/players/:id/unarchive', (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    const player = golfDb.prepare('SELECT id FROM players WHERE id = ?').get(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    golfDb.prepare('UPDATE players SET archived = 0 WHERE id = ?').run(playerId);
    return res.json({ message: 'Player restored' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/golf/admin/players/:id
 * Permanently delete a player account (and cascade scores/handicaps).
 */
router.delete('/players/:id', (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });
    if (playerId === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

    const player = golfDb.prepare('SELECT id FROM players WHERE id = ?').get(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    golfDb.prepare('DELETE FROM players WHERE id = ?').run(playerId);
    return res.json({ message: 'Player deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/admin/scores
 * Admin submits a score on behalf of any player.
 */
router.post('/scores', async (req, res) => {
  try {
    const { player_id, score, date_played, holes, course_id } = req.body;

    if (!player_id || isNaN(parseInt(player_id, 10))) {
      return res.status(400).json({ error: 'player_id is required' });
    }
    const playerId = parseInt(player_id, 10);

    const player = golfDb.prepare('SELECT id FROM players WHERE id = ? AND role = ?').get(playerId, 'player');
    if (!player) return res.status(404).json({ error: 'Player not found' });

    if (!isValidScore(score)) {
      return res.status(400).json({ error: 'Score must be a positive integer' });
    }

    const holesValue = holes !== undefined && holes !== null ? parseInt(holes, 10) : 18;
    if (!isValidHoles(holesValue)) {
      return res.status(400).json({ error: 'Holes must be 9 or 18' });
    }

    if (!date_played || !isValidDate(date_played)) {
      return res.status(400).json({ error: 'date_played must be YYYY-MM-DD' });
    }

    let courseIdValue = null;
    if (course_id !== undefined && course_id !== null && course_id !== '') {
      const course = golfDb.prepare('SELECT id FROM courses WHERE id = ?').get(parseInt(course_id, 10));
      if (!course) return res.status(400).json({ error: 'Invalid course_id' });
      courseIdValue = parseInt(course_id, 10);
    }

    const result = golfDb.prepare(
      'INSERT INTO scores (player_id, score, holes, course_id, date_played) VALUES (?, ?, ?, ?, ?)'
    ).run(playerId, score, holesValue, courseIdValue, date_played);

    await recalculateHandicap(playerId);

    const created = golfDb.prepare(`
      SELECT s.id, s.player_id, p.username, s.score, s.holes,
             s.course_id, c.name AS course_name, s.date_played, s.created_at
      FROM scores s
      JOIN players p ON s.player_id = p.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json(created);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Score already exists for this player on that date' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Scores ───────────────────────────────────────────────────────────────────

/**
 * GET /api/golf/admin/scores
 * List all scores across all players.
 */
router.get('/scores', (req, res) => {
  try {
    const scores = golfDb.prepare(`
      SELECT s.id, s.player_id, p.username, s.score, s.holes,
             s.course_id, c.name AS course_name, s.date_played, s.created_at
      FROM scores s
      JOIN players p ON s.player_id = p.id
      LEFT JOIN courses c ON s.course_id = c.id
      ORDER BY s.date_played DESC, p.username
    `).all();
    return res.json(scores);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/golf/admin/scores/:id
 * Edit any score, including course.
 */
router.put('/scores/:id', async (req, res) => {
  try {
    const scoreId = parseInt(req.params.id, 10);
    if (isNaN(scoreId)) return res.status(400).json({ error: 'Invalid score ID' });

    const existing = golfDb.prepare('SELECT * FROM scores WHERE id = ?').get(scoreId);
    if (!existing) return res.status(404).json({ error: 'Score not found' });

    const { score, date_played, holes, course_id } = req.body;

    if (score !== undefined && !isValidScore(score)) {
      return res.status(400).json({ error: 'Score must be a positive integer' });
    }
    if (holes !== undefined && !isValidHoles(holes)) {
      return res.status(400).json({ error: 'Holes must be 9 or 18' });
    }
    if (date_played !== undefined && !isValidDate(date_played)) {
      return res.status(400).json({ error: 'date_played must be YYYY-MM-DD' });
    }

    // course_id: null clears it, a number must reference a valid course
    let newCourseId = existing.course_id;
    if (course_id !== undefined) {
      if (course_id === null || course_id === '') {
        newCourseId = null;
      } else {
        const course = golfDb.prepare('SELECT id FROM courses WHERE id = ?').get(parseInt(course_id, 10));
        if (!course) return res.status(400).json({ error: 'Invalid course_id' });
        newCourseId = parseInt(course_id, 10);
      }
    }

    const newScore = score !== undefined ? score : existing.score;
    const newHoles = holes !== undefined ? holes : existing.holes;
    const newDate  = date_played !== undefined ? date_played : existing.date_played;

    golfDb.prepare(
      'UPDATE scores SET score = ?, holes = ?, date_played = ?, course_id = ? WHERE id = ?'
    ).run(newScore, newHoles, newDate, newCourseId, scoreId);

    await recalculateHandicap(existing.player_id);

    const updated = golfDb.prepare(`
      SELECT s.id, s.player_id, p.username, s.score, s.holes,
             s.course_id, c.name AS course_name, s.date_played, s.created_at
      FROM scores s
      JOIN players p ON s.player_id = p.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.id = ?
    `).get(scoreId);

    return res.json(updated);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Score already exists for this date' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/golf/admin/scores/:id
 * Delete any score.
 */
router.delete('/scores/:id', async (req, res) => {
  try {
    const scoreId = parseInt(req.params.id, 10);
    if (isNaN(scoreId)) return res.status(400).json({ error: 'Invalid score ID' });

    const existing = golfDb.prepare('SELECT * FROM scores WHERE id = ?').get(scoreId);
    if (!existing) return res.status(404).json({ error: 'Score not found' });

    golfDb.prepare('DELETE FROM scores WHERE id = ?').run(scoreId);
    await recalculateHandicap(existing.player_id);

    return res.json({ message: 'Score deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/admin/broadcast
 * Send a message to all active (non-archived) players, or to a specific player if player_id is provided.
 * Stores in notifications table for in-app viewing.
 * Returns the list of member emails and phones for external sending.
 */
router.post('/broadcast', (req, res) => {
  try {
    const { subject, body, player_id } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    let players;
    if (player_id) {
      // Send to specific player
      const player = golfDb.prepare(
        "SELECT id, username, first_name, last_name, email, phone FROM players WHERE id = ? AND (archived IS NULL OR archived = 0)"
      ).get(parseInt(player_id, 10));
      if (!player) return res.status(404).json({ error: 'Player not found' });
      players = [player];
    } else {
      // Send to all active non-admin players
      players = golfDb.prepare(
        "SELECT id, username, first_name, last_name, email, phone FROM players WHERE role = 'player' AND (archived IS NULL OR archived = 0)"
      ).all();
    }

    // Insert notification for each player
    const insert = golfDb.prepare(
      'INSERT INTO notifications (player_id, subject, body) VALUES (?, ?, ?)'
    );
    const insertAll = golfDb.transaction((items) => {
      for (const p of items) {
        insert.run(p.id, subject.trim(), body.trim());
      }
    });
    insertAll(players);

    // Return contact info for external sending
    const emails = players.filter(p => p.email).map(p => p.email);
    const phones = players.filter(p => p.phone).map(p => ({
      name: `${p.first_name || p.username} ${p.last_name || ''}`.trim(),
      phone: p.phone,
    }));

    return res.json({
      message: `Notification sent to ${players.length} member${players.length !== 1 ? 's' : ''}`,
      count: players.length,
      emails,
      phones,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * GET /api/golf/admin/messages
 * List all messages, newest first.
 */
router.get('/messages', (req, res) => {
  try {
    const messages = golfDb.prepare(`
      SELECT m.id, m.player_id, p.username, p.first_name, p.last_name,
             m.subject, m.body, m.read, m.created_at
      FROM messages m
      JOIN players p ON m.player_id = p.id
      ORDER BY m.read ASC, m.created_at DESC
    `).all();
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/admin/messages/unread-count
 * Count of unread messages.
 */
router.get('/messages/unread-count', (req, res) => {
  try {
    const result = golfDb.prepare('SELECT COUNT(*) AS count FROM messages WHERE read = 0').get();
    return res.json({ count: result.count });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/admin/messages/:id/read
 * Mark a message as read.
 */
router.post('/messages/:id/read', (req, res) => {
  try {
    const msgId = parseInt(req.params.id, 10);
    if (isNaN(msgId)) return res.status(400).json({ error: 'Invalid message ID' });
    golfDb.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(msgId);
    return res.json({ message: 'Marked as read' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/golf/admin/messages/:id
 * Delete a message.
 */
router.delete('/messages/:id', (req, res) => {
  try {
    const msgId = parseInt(req.params.id, 10);
    if (isNaN(msgId)) return res.status(400).json({ error: 'Invalid message ID' });
    golfDb.prepare('DELETE FROM messages WHERE id = ?').run(msgId);
    return res.json({ message: 'Message deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/admin/players/:id/approve
 * Approve a pending registration.
 */
router.post('/players/:id/approve', (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    const player = golfDb.prepare('SELECT id, username FROM players WHERE id = ?').get(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    golfDb.prepare('UPDATE players SET pending_approval = 0 WHERE id = ?').run(playerId);

    // Notify the player
    golfDb.prepare(
      'INSERT INTO notifications (player_id, subject, body) VALUES (?, ?, ?)'
    ).run(playerId, 'Registration Approved!', 'Welcome to WAGL! Your account has been approved. You can now log in and start playing.');

    return res.json({ message: 'Player approved' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/admin/players/:id/deny
 * Deny and delete a pending registration.
 */
router.post('/players/:id/deny', (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    const player = golfDb.prepare('SELECT id FROM players WHERE id = ? AND pending_approval = 1').get(playerId);
    if (!player) return res.status(404).json({ error: 'Pending player not found' });

    golfDb.prepare('DELETE FROM players WHERE id = ?').run(playerId);
    return res.json({ message: 'Registration denied and account deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/admin/players/:id/force-reset
 * Force a user to reset their password on next login.
 */
router.post('/players/:id/force-reset', (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    const player = golfDb.prepare('SELECT id FROM players WHERE id = ?').get(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    golfDb.prepare('UPDATE players SET force_password_reset = 1 WHERE id = ?').run(playerId);
    return res.json({ message: 'Password reset forced for next login' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/admin/settings/max-players
 * Get the current max players setting.
 */
router.get('/settings/max-players', (req, res) => {
  try {
    const setting = golfDb.prepare("SELECT value FROM league_settings WHERE key = 'max_players'").get();
    const currentCount = golfDb.prepare("SELECT COUNT(*) AS count FROM players WHERE role = 'player' AND (archived IS NULL OR archived = 0)").get();
    return res.json({
      max_players: setting ? parseInt(setting.value, 10) : 50,
      current_count: currentCount.count,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/golf/admin/settings/max-players
 * Set the max players cap (0-100).
 */
router.put('/settings/max-players', (req, res) => {
  try {
    const { max_players } = req.body;
    const value = parseInt(max_players, 10);
    if (isNaN(value) || value < 0 || value > 100) {
      return res.status(400).json({ error: 'max_players must be between 0 and 100' });
    }

    golfDb.prepare("INSERT OR REPLACE INTO league_settings (key, value) VALUES ('max_players', ?)").run(String(value));
    return res.json({ max_players: value });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/golf/admin/scores/year/:year
 * Delete all scores for a specific year. Handicaps are preserved.
 */
router.delete('/scores/year/:year', (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    const result = golfDb.prepare(
      "DELETE FROM scores WHERE strftime('%Y', date_played) = ?"
    ).run(String(year));

    return res.json({ message: `Deleted ${result.changes} scores from ${year}. Handicaps preserved.` });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/admin/scores/years
 * Get list of years that have scores.
 */
router.get('/scores/years', (req, res) => {
  try {
    const years = golfDb.prepare(
      "SELECT DISTINCT strftime('%Y', date_played) AS year, COUNT(*) AS count FROM scores GROUP BY year ORDER BY year DESC"
    ).all();
    return res.json(years);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Contest Winners ──────────────────────────────────────────────────────────

/**
 * POST /api/golf/admin/contest-winners
 * Set a contest winner for an event. Upserts by event_date + category.
 * Body: { event_date, category, player_name, player_id (optional), distance (optional) }
 */
router.post('/contest-winners', (req, res) => {
  try {
    const { event_date, category, player_name, player_id, distance } = req.body;

    if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
      return res.status(400).json({ error: 'event_date must be YYYY-MM-DD' });
    }
    if (!['mens_closest', 'womens_closest', 'longest_putt'].includes(category)) {
      return res.status(400).json({ error: 'category must be mens_closest, womens_closest, or longest_putt' });
    }
    if (!player_name || typeof player_name !== 'string' || !player_name.trim()) {
      return res.status(400).json({ error: 'player_name is required' });
    }

    const existing = golfDb.prepare(
      'SELECT id FROM contest_winners WHERE event_date = ? AND category = ?'
    ).get(event_date, category);

    if (existing) {
      golfDb.prepare(
        'UPDATE contest_winners SET player_name = ?, player_id = ?, distance = ? WHERE id = ?'
      ).run(player_name.trim(), player_id || null, distance || '', existing.id);
    } else {
      golfDb.prepare(
        'INSERT INTO contest_winners (event_date, category, player_name, player_id, distance) VALUES (?, ?, ?, ?, ?)'
      ).run(event_date, category, player_name.trim(), player_id || null, distance || '');
    }

    return res.json({ message: 'Contest winner saved' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── RSVPs ────────────────────────────────────────────────────────────────────

/**
 * GET /api/golf/admin/rsvps
 * List all RSVPs, optionally filtered by event_date query param.
 */
router.get('/rsvps', (req, res) => {
  try {
    const { event_date } = req.query;
    let rows;
    if (event_date) {
      rows = golfDb.prepare(`
        SELECT r.id, r.player_id, p.username, p.first_name, p.last_name,
               r.event_date, r.course_name, r.response, r.created_at
        FROM rsvps r
        JOIN players p ON r.player_id = p.id
        WHERE r.event_date = ?
        ORDER BY r.response ASC, p.username ASC
      `).all(event_date);
    } else {
      rows = golfDb.prepare(`
        SELECT r.id, r.player_id, p.username, p.first_name, p.last_name,
               r.event_date, r.course_name, r.response, r.created_at
        FROM rsvps r
        JOIN players p ON r.player_id = p.id
        ORDER BY r.event_date DESC, r.response ASC, p.username ASC
      `).all();
    }
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── CSV Import ───────────────────────────────────────────────────────────────

/**
 * POST /api/golf/admin/import-csv
 * Upload a CSV file with historical scores.
 * Expected CSV columns: username, score, date_played, holes (optional), course_id (optional)
 * Returns a summary of imported rows and any errors.
 */
router.post('/import-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const content = req.file.buffer.toString('utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const usernameIdx = headers.indexOf('username');
    const scoreIdx = headers.indexOf('score');
    const dateIdx = headers.indexOf('date_played');
    const holesIdx = headers.indexOf('holes');
    const courseIdx = headers.indexOf('course_id');

    if (usernameIdx === -1 || scoreIdx === -1 || dateIdx === -1) {
      return res.status(400).json({ error: 'CSV must have columns: username, score, date_played' });
    }

    const results = { imported: 0, skipped: 0, errors: [] };
    const affectedPlayers = new Set();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const username = cols[usernameIdx];
      const scoreRaw = parseInt(cols[scoreIdx], 10);
      const datePlayed = cols[dateIdx];
      const holes = holesIdx !== -1 && cols[holesIdx] ? parseInt(cols[holesIdx], 10) : 18;
      const courseId = courseIdx !== -1 && cols[courseIdx] ? parseInt(cols[courseIdx], 10) : null;

      // Validate row
      if (!username) { results.errors.push(`Row ${i + 1}: missing username`); results.skipped++; continue; }
      if (!isValidScore(scoreRaw)) { results.errors.push(`Row ${i + 1}: invalid score "${cols[scoreIdx]}"`); results.skipped++; continue; }
      if (!isValidDate(datePlayed)) { results.errors.push(`Row ${i + 1}: invalid date "${datePlayed}"`); results.skipped++; continue; }
      if (!isValidHoles(holes)) { results.errors.push(`Row ${i + 1}: holes must be 9 or 18`); results.skipped++; continue; }

      // Look up player
      const player = golfDb.prepare('SELECT id FROM players WHERE username = ?').get(username);
      if (!player) { results.errors.push(`Row ${i + 1}: player "${username}" not found`); results.skipped++; continue; }

      // Validate course if provided
      if (courseId !== null) {
        const course = golfDb.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
        if (!course) { results.errors.push(`Row ${i + 1}: course_id ${courseId} not found`); results.skipped++; continue; }
      }

      try {
        golfDb.prepare(
          'INSERT OR IGNORE INTO scores (player_id, score, holes, course_id, date_played) VALUES (?, ?, ?, ?, ?)'
        ).run(player.id, scoreRaw, holes, courseId, datePlayed);
        affectedPlayers.add(player.id);
        results.imported++;
      } catch (e) {
        results.errors.push(`Row ${i + 1}: ${e.message}`);
        results.skipped++;
      }
    }

    // Recalculate handicaps for all affected players
    for (const playerId of affectedPlayers) {
      await recalculateHandicap(playerId);
    }

    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
