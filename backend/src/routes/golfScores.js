const express = require('express');
const golfDb = require('../db/golfDatabase');
const { authMiddleware, adminMiddleware } = require('../middleware/golfAuth');
const { calculateHandicap } = require('../services/handicapClient');
const { calculateWeeklyPoints, recalculateWaglHandicap } = require('../services/waglScoring');

const router = express.Router();

// Default course values used when calling the handicap service
const DEFAULT_COURSE_RATING = 72.0;
const DEFAULT_SLOPE_RATING = 113;

/**
 * GET /api/golf/players/:id
 * Public endpoint: return a player's public profile info.
 */
router.get('/players/:id', (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    const player = golfDb.prepare(`
      SELECT p.id, p.username, p.first_name, p.last_name, p.email, p.phone, p.avatar, p.created_at,
             h.handicap_index,
             COUNT(s.id) AS score_count
      FROM players p
      LEFT JOIN handicaps h ON p.id = h.player_id
      LEFT JOIN scores s ON p.id = s.player_id
      WHERE p.id = ? AND p.role = 'player'
      GROUP BY p.id
    `).get(playerId);

    if (!player) return res.status(404).json({ error: 'Player not found' });
    return res.json(player);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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
 * Recalculates and upserts the handicap for a given player using WAGL method.
 */
async function recalculateHandicap(playerId) {
  return recalculateWaglHandicap(playerId);
}

/**
 * GET /api/golf/courses
 * Public endpoint: return all available courses grouped by county.
 */
router.get('/courses', (req, res) => {
  try {
    const courses = golfDb.prepare(
      'SELECT id, name, county, course_rating, slope_rating, holes, par_front, par_back FROM courses ORDER BY county, name'
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

    // Enforce 24-hour submission window for players (admins bypass this)
    if (req.user.role !== 'admin') {
      const playedMs = new Date(date_played + 'T00:00:00Z').getTime();
      const nowMs = Date.now();
      const diffHours = Math.abs(nowMs - playedMs) / (1000 * 60 * 60);
      if (diffHours > 24) {
        return res.status(403).json({ error: 'Scores must be submitted within 24 hours of the date played. Please contact your admin.' });
      }
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
 * weekly_points is a placeholder — full calculation to be added later.
 * Sorted by handicap_index ASC (nulls last).
 */
router.get('/leaderboard', (req, res) => {
  try {
    const { year } = req.query;
    const yearFilter = year ? `AND strftime('%Y', s1.date_played) = '${parseInt(year, 10)}'` : '';
    const yearFilterScores = year ? `AND strftime('%Y', date_played) = '${parseInt(year, 10)}'` : '';

    const leaderboard = golfDb.prepare(`
      SELECT
        p.id,
        p.username,
        p.first_name,
        p.last_name,
        rs.score AS most_recent_score,
        rs.holes,
        rs.date_played,
        rs.course_name,
        CASE
          WHEN date(rs.date_played, 'weekday 0', '-6 days') = date('now', 'weekday 0', '-6 days')
          THEN 1 ELSE 0
        END AS scored_this_week,
        h.handicap_index,
        NULL AS season_total_points,
        NULL AS weekly_points
      FROM players p
      LEFT JOIN (
        SELECT s1.player_id, s1.score, s1.holes, s1.date_played, c.name AS course_name
        FROM scores s1
        LEFT JOIN courses c ON s1.course_id = c.id
        INNER JOIN (
          SELECT player_id, MAX(date_played) AS max_date
          FROM scores
          WHERE 1=1 ${yearFilterScores}
          GROUP BY player_id
        ) s2 ON s1.player_id = s2.player_id AND s1.date_played = s2.max_date
        WHERE 1=1 ${yearFilter}
      ) rs ON p.id = rs.player_id
      LEFT JOIN handicaps h ON p.id = h.player_id
      WHERE p.role = 'player' AND (p.archived IS NULL OR p.archived = 0)
      ORDER BY
        CASE WHEN h.handicap_index IS NULL THEN 1 ELSE 0 END,
        h.handicap_index ASC
    `).all();

    // Calculate season total points for each player
    // Get all unique dates that have scores (filtered by year if specified)
    const allDates = golfDb.prepare(
      `SELECT DISTINCT date_played FROM scores WHERE 1=1 ${yearFilterScores} ORDER BY date_played`
    ).all().map(r => r.date_played);

    // Calculate points for each date and accumulate per player
    const seasonPoints = {};
    const lastWeekPoints = {};

    for (const date of allDates) {
      const weeklyPts = calculateWeeklyPoints(date);
      for (const wp of weeklyPts) {
        if (!seasonPoints[wp.player_id]) seasonPoints[wp.player_id] = 0;
        seasonPoints[wp.player_id] += wp.total_pts;
        lastWeekPoints[wp.player_id] = wp.total_pts; // last date's points
      }
    }

    // Attach points to leaderboard
    const result = leaderboard.map(p => ({
      ...p,
      season_total_points: seasonPoints[p.id] || null,
      weekly_points: lastWeekPoints[p.id] || null,
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/weeks
 * Public endpoint: returns a list of distinct week start dates (Monday) that have scores.
 * Each entry: { week_start: 'YYYY-MM-DD', label: 'Week of Mon DD, YYYY' }
 */
router.get('/weeks', (req, res) => {
  try {
    // SQLite: date(date_played, 'weekday 0', '-6 days') gives the Monday of the week
    const rows = golfDb.prepare(`
      SELECT DISTINCT
        date(date_played, 'weekday 0', '-6 days') AS week_start
      FROM scores
      ORDER BY week_start DESC
    `).all();

    const weeks = rows.map(r => {
      const d = new Date(r.week_start + 'T00:00:00Z');
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      return { week_start: r.week_start, label: `Week of ${label}` };
    });

    return res.status(200).json(weeks);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/leaderboard/weekly?week=YYYY-MM-DD
 * Public endpoint: returns all player scores for the given date.
 * weekly_points is a placeholder — full calculation to be added later.
 */
router.get('/leaderboard/weekly', (req, res) => {
  try {
    const { week } = req.query;

    // If no week param, return ALL scores sorted by date
    if (!week) {
      const rows = golfDb.prepare(`
        SELECT
          p.id,
          p.username,
          p.first_name,
          p.last_name,
          s.score,
          s.holes,
          s.date_played,
          c.name AS course_name,
          c.course_rating,
          c.slope_rating,
          h.handicap_index
        FROM scores s
        JOIN players p ON s.player_id = p.id
        LEFT JOIN courses c ON s.course_id = c.id
        LEFT JOIN handicaps h ON p.id = h.player_id
        WHERE p.role = 'player' AND (p.archived IS NULL OR p.archived = 0)
        ORDER BY s.date_played DESC, s.score ASC
      `).all();

      // Calculate points for each unique date
      const dateSet = [...new Set(rows.map(r => r.date_played))];
      const pointsMap = {};
      for (const d of dateSet) {
        const pts = calculateWeeklyPoints(d);
        for (const wp of pts) {
          pointsMap[`${wp.player_id}_${d}`] = wp.total_pts;
        }
      }
      const result = rows.map(r => ({
        ...r,
        weekly_points: pointsMap[`${r.id}_${r.date_played}`] || null,
      }));
      return res.status(200).json(result);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      return res.status(400).json({ error: 'week query param must be YYYY-MM-DD' });
    }

    // Match scores within ±2 days of the event date to account for flexible play dates
    const rows = golfDb.prepare(`
      SELECT
        p.id,
        p.username,
        p.first_name,
        p.last_name,
        s.score,
        s.holes,
        s.date_played,
        c.name AS course_name,
        c.course_rating,
        c.slope_rating,
        h.handicap_index
      FROM scores s
      JOIN players p ON s.player_id = p.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN handicaps h ON p.id = h.player_id
      WHERE p.role = 'player' AND (p.archived IS NULL OR p.archived = 0)
        AND s.date_played BETWEEN date(?, '-2 days') AND date(?, '+2 days')
      ORDER BY s.score ASC, p.username ASC
    `).all(week, week);

    // Calculate points for the matched dates
    const dateSet = [...new Set(rows.map(r => r.date_played))];
    const pointsMap = {};
    for (const d of dateSet) {
      const pts = calculateWeeklyPoints(d);
      for (const wp of pts) {
        pointsMap[`${wp.player_id}_${d}`] = wp.total_pts;
      }
    }
    const result = rows.map(r => ({
      ...r,
      weekly_points: pointsMap[`${r.id}_${r.date_played}`] || null,
    }));

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/seasons
 * Public endpoint: returns list of years that have scores.
 */
router.get('/seasons', (req, res) => {
  try {
    const years = golfDb.prepare(
      "SELECT DISTINCT strftime('%Y', date_played) AS year FROM scores ORDER BY year DESC"
    ).all();
    return res.json(years.map(r => r.year));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/contest-winners?event_date=YYYY-MM-DD
 * Public endpoint: returns contest winners. If no date, returns all.
 */
router.get('/contest-winners', (req, res) => {
  try {
    const { event_date } = req.query;
    let rows;
    if (event_date) {
      rows = golfDb.prepare(`
        SELECT cw.*, h.handicap_index,
               s.score AS player_score
        FROM contest_winners cw
        LEFT JOIN handicaps h ON cw.player_id = h.player_id
        LEFT JOIN scores s ON cw.player_id = s.player_id
          AND s.date_played BETWEEN date(cw.event_date, '-2 days') AND date(cw.event_date, '+2 days')
        WHERE cw.event_date = ?
        ORDER BY cw.category
      `).all(event_date);
    } else {
      rows = golfDb.prepare(`
        SELECT cw.*, h.handicap_index,
               s.score AS player_score
        FROM contest_winners cw
        LEFT JOIN handicaps h ON cw.player_id = h.player_id
        LEFT JOIN scores s ON cw.player_id = s.player_id
          AND s.date_played BETWEEN date(cw.event_date, '-2 days') AND date(cw.event_date, '+2 days')
        ORDER BY cw.event_date DESC, cw.category
      `).all();
    }
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/tee-assignments?event_date=YYYY-MM-DD
 * Public (auth required): load saved tee time assignments for an event.
 */
router.get('/tee-assignments', authMiddleware, (req, res) => {
  try {
    const { event_date } = req.query;
    if (!event_date) return res.status(400).json({ error: 'event_date required' });

    const rows = golfDb.prepare(
      'SELECT slot_index, position, player_id FROM tee_assignments WHERE event_date = ? ORDER BY slot_index, position'
    ).all(event_date);

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/rsvps/event?event_date=YYYY-MM-DD
 * Public (auth required): list all RSVPs for an event date.
 */
router.get('/rsvps/event', authMiddleware, (req, res) => {
  try {
    const { event_date } = req.query;
    if (!event_date) return res.status(400).json({ error: 'event_date required' });

    const rows = golfDb.prepare(`
      SELECT r.id, r.player_id, p.username, p.first_name, p.last_name,
             r.event_date, r.course_name, r.response, r.created_at
      FROM rsvps r
      JOIN players p ON r.player_id = p.id
      WHERE r.event_date = ?
      ORDER BY r.response ASC, p.last_name ASC
    `).all(event_date);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/rsvp?event_date=YYYY-MM-DD
 * Get the authenticated user's RSVP for a specific event date.
 */
router.get('/rsvp', authMiddleware, (req, res) => {
  try {
    const { event_date } = req.query;
    if (!event_date) return res.json({ response: null });

    const rsvp = golfDb.prepare(
      'SELECT response FROM rsvps WHERE player_id = ? AND event_date = ?'
    ).get(req.user.id, event_date);

    return res.json({ response: rsvp ? rsvp.response : null });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/rsvp
 * Submit or update an RSVP for a future event.
 * Body: { event_date, course_name, response: 'yes'|'no' }
 */
router.post('/rsvp', authMiddleware, (req, res) => {
  try {
    const { event_date, course_name, response } = req.body;
    const playerId = req.user.id;

    if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
      return res.status(400).json({ error: 'event_date must be YYYY-MM-DD' });
    }
    if (!course_name || typeof course_name !== 'string') {
      return res.status(400).json({ error: 'course_name is required' });
    }
    if (!['yes', 'no'].includes(response)) {
      return res.status(400).json({ error: 'response must be yes or no' });
    }

    // Upsert
    const existing = golfDb.prepare(
      'SELECT id FROM rsvps WHERE player_id = ? AND event_date = ?'
    ).get(playerId, event_date);

    if (existing) {
      golfDb.prepare(
        "UPDATE rsvps SET response = ?, course_name = ?, created_at = datetime('now') WHERE id = ?"
      ).run(response, course_name, existing.id);
    } else {
      golfDb.prepare(
        'INSERT INTO rsvps (player_id, event_date, course_name, response) VALUES (?, ?, ?, ?)'
      ).run(playerId, event_date, course_name, response);
    }

    return res.status(200).json({ message: 'RSVP saved' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
