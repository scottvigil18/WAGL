const express = require('express');
const golfDb = require('../db/golfDatabase');
const { authMiddleware, adminMiddleware } = require('../middleware/golfAuth');
const { calculateHandicap } = require('../services/handicapClient');

const router = express.Router();

// Default course values used when calling the handicap service
const DEFAULT_COURSE_RATING = 72.0;
const DEFAULT_SLOPE_RATING = 113;

/**
 * Validates that a score is a positive integer.
 */
function isValidScore(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Validates that holes is either 9 or 18.
 */
function isValidHoles(value) {
  return value === 9 || value === 18;
}

/**
 * Validates an ISO 8601 date string (YYYY-MM-DD format).
 */
function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Recalculates and upserts the handicap for a given player.
 * Uses each score's associated course rating/slope for differential calculation.
 */
async function recalculateHandicap(playerId) {
  const rows = golfDb.prepare(
    `SELECT s.score, c.course_rating, c.slope_rating
     FROM scores s
     LEFT JOIN courses c ON s.course_id = c.id
     WHERE s.player_id = ?
     ORDER BY s.date_played DESC`
  ).all(playerId);

  const scores = rows.map((r) => r.score);
  // Use the most common course rating or default
  const courseRating = rows.length > 0 && rows[0].course_rating ? rows[0].course_rating : DEFAULT_COURSE_RATING;
  const slopeRating = rows.length > 0 && rows[0].slope_rating ? rows[0].slope_rating : DEFAULT_SLOPE_RATING;

  const result = await calculateHandicap(scores, courseRating, slopeRating);

  // Upsert handicap
  const existing = golfDb.prepare(
    'SELECT id FROM handicaps WHERE player_id = ?'
  ).get(playerId);

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

/**
 * GET /api/golf/courses
 * Public endpoint: return all available courses grouped by county.
 */
router.get('/courses', (req, res) => {
  try {
    const courses = golfDb.prepare(
      'SELECT id, name, county, course_rating, slope_rating, holes FROM courses ORDER BY county, name'
    ).all();

    return res.status(200).json(courses);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/scores
 * Submit a new score for the authenticated player.
 */
router.post('/scores', authMiddleware, async (req, res) => {
  try {
    const { score, date_played, holes, course_id } = req.body;
    const playerId = req.user.id;

    // Validate score
    if (score === undefined || score === null || !isValidScore(score)) {
      return res.status(400).json({ error: 'Score must be a positive integer' });
    }

    // Validate holes (default to 18 if not provided)
    const holesValue = holes !== undefined && holes !== null ? holes : 18;
    if (!isValidHoles(holesValue)) {
      return res.status(400).json({ error: 'Holes must be 9 or 18' });
    }

    // Validate course_id if provided
    let courseIdValue = null;
    if (course_id !== undefined && course_id !== null) {
      const course = golfDb.prepare('SELECT id FROM courses WHERE id = ?').get(course_id);
      if (!course) {
        return res.status(400).json({ error: 'Invalid course_id' });
      }
      courseIdValue = course_id;
    }

    // Validate date_played
    if (!date_played || !isValidDate(date_played)) {
      return res.status(400).json({ error: 'date_played must be a valid ISO 8601 date (YYYY-MM-DD)' });
    }

    // Insert score (UNIQUE constraint will catch duplicates)
    const result = golfDb.prepare(
      'INSERT INTO scores (player_id, score, holes, course_id, date_played) VALUES (?, ?, ?, ?, ?)'
    ).run(playerId, score, holesValue, courseIdValue, date_played);

    // Recalculate handicap
    await recalculateHandicap(playerId);

    // Fetch the created entry
    const created = golfDb.prepare('SELECT id, score, holes, course_id, date_played, created_at FROM scores WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json(created);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Score already submitted for this date' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/golf/scores/:id
 * Admin-only: edit an existing score.
 */
router.put('/scores/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const scoreId = parseInt(req.params.id, 10);
    if (isNaN(scoreId)) {
      return res.status(400).json({ error: 'Invalid score ID' });
    }

    const { score, date_played, holes } = req.body;

    // Check score exists
    const existing = golfDb.prepare('SELECT * FROM scores WHERE id = ?').get(scoreId);
    if (!existing) {
      return res.status(404).json({ error: 'Score not found' });
    }

    // Validate score if provided
    if (score !== undefined && score !== null) {
      if (!isValidScore(score)) {
        return res.status(400).json({ error: 'Score must be a positive integer' });
      }
    }

    // Validate holes if provided
    if (holes !== undefined && holes !== null) {
      if (!isValidHoles(holes)) {
        return res.status(400).json({ error: 'Holes must be 9 or 18' });
      }
    }

    // Validate date_played if provided
    if (date_played !== undefined && date_played !== null) {
      if (!isValidDate(date_played)) {
        return res.status(400).json({ error: 'date_played must be a valid ISO 8601 date (YYYY-MM-DD)' });
      }
    }

    // Build update
    const newScore = (score !== undefined && score !== null) ? score : existing.score;
    const newHoles = (holes !== undefined && holes !== null) ? holes : existing.holes;
    const newDate = (date_played !== undefined && date_played !== null) ? date_played : existing.date_played;

    golfDb.prepare(
      'UPDATE scores SET score = ?, holes = ?, date_played = ? WHERE id = ?'
    ).run(newScore, newHoles, newDate, scoreId);

    // Recalculate handicap for the affected player
    await recalculateHandicap(existing.player_id);

    // Fetch updated entry
    const updated = golfDb.prepare('SELECT id, player_id, score, holes, date_played, created_at FROM scores WHERE id = ?').get(scoreId);

    return res.status(200).json(updated);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Score already submitted for this date' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/scores/me
 * Return all scores for the authenticated player, ordered by date_played DESC.
 */
router.get('/scores/me', authMiddleware, (req, res) => {
  try {
    const playerId = req.user.id;

    const scores = golfDb.prepare(
      `SELECT s.id, s.score, s.holes, s.course_id, c.name AS course_name, s.date_played, s.created_at
       FROM scores s
       LEFT JOIN courses c ON s.course_id = c.id
       WHERE s.player_id = ?
       ORDER BY s.date_played DESC`
    ).all(playerId);

    return res.status(200).json(scores);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/leaderboard
 * Public endpoint: return all players with their most recent score, date_played, and handicap_index.
 * Sorted by handicap_index ASC (nulls last).
 */
router.get('/leaderboard', (req, res) => {
  try {
    const leaderboard = golfDb.prepare(`
      SELECT
        p.id,
        p.username,
        rs.score AS most_recent_score,
        rs.holes,
        rs.date_played,
        rs.course_name,
        h.handicap_index
      FROM players p
      LEFT JOIN (
        SELECT s1.player_id, s1.score, s1.holes, s1.date_played, c.name AS course_name
        FROM scores s1
        LEFT JOIN courses c ON s1.course_id = c.id
        INNER JOIN (
          SELECT player_id, MAX(date_played) AS max_date
          FROM scores
          GROUP BY player_id
        ) s2 ON s1.player_id = s2.player_id AND s1.date_played = s2.max_date
      ) rs ON p.id = rs.player_id
      LEFT JOIN handicaps h ON p.id = h.player_id
      ORDER BY
        CASE WHEN h.handicap_index IS NULL THEN 1 ELSE 0 END,
        h.handicap_index ASC
    `).all();

    return res.status(200).json(leaderboard);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
