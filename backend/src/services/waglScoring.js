/**
 * WAGL Scoring System
 * 
 * Handicap: Average of OverPar scores (score - par) from recent rounds.
 * Uses the best 75% of last 20 scores (or all if fewer than 20).
 * 
 * Weekly Points:
 * - Base: 3 points for playing
 * - Bonus: 3-7 points based on net performance within flight
 * - Total possible: 6-10 per week
 * 
 * Flights: Divided into thirds based on handicap (Low, Mid, High)
 */

const golfDb = require('../db/golfDatabase');

const PAR = 36; // 9-hole par

/**
 * Calculate a player's handicap based on their recent scores.
 * Uses the average of the best 75% of the last 20 scores' OverPar values.
 */
function calculateWaglHandicap(playerId) {
  const scores = golfDb.prepare(
    'SELECT score FROM scores WHERE player_id = ? ORDER BY date_played DESC LIMIT 20'
  ).all(playerId);

  if (scores.length === 0) return null;

  // Convert to OverPar values
  const overPars = scores.map(s => s.score - PAR);

  // Use best 75% (lowest OverPar values)
  overPars.sort((a, b) => a - b);
  const useCount = Math.max(1, Math.ceil(overPars.length * 0.75));
  const best = overPars.slice(0, useCount);

  // Average
  const avg = best.reduce((sum, v) => sum + v, 0) / best.length;
  return Math.round((avg + PAR) * 10) / 10; // Store as score-based handicap
}

/**
 * Get flight assignments for all active players.
 * Returns { low: [...], mid: [...], high: [...] }
 */
function getFlightAssignments() {
  const players = golfDb.prepare(`
    SELECT p.id, p.username, h.handicap_index
    FROM players p
    LEFT JOIN handicaps h ON p.id = h.player_id
    WHERE p.role = 'player' AND (p.archived IS NULL OR p.archived = 0)
      AND h.handicap_index IS NOT NULL
    ORDER BY h.handicap_index ASC
  `).all();

  const third = Math.ceil(players.length / 3);
  return {
    low: players.slice(0, third),
    mid: players.slice(third, third * 2),
    high: players.slice(third * 2),
  };
}

/**
 * Calculate weekly bonus points for a set of scores within a flight.
 * Best performer gets 4, worst gets 0, linear interpolation.
 * Total weekly = 3 base + 0-4 bonus = 3-7 per week.
 * @param {Array} scores - Array of { player_id, score }
 * @returns {Map} player_id -> bonus points (0-4)
 */
function calculateBonusPoints(scores) {
  if (scores.length === 0) return new Map();

  // Sort by score (lower is better)
  const sorted = [...scores].sort((a, b) => a.score - b.score);
  const points = new Map();

  for (let i = 0; i < sorted.length; i++) {
    // Linear interpolation: best=4, worst=0
    const ratio = sorted.length > 1 ? i / (sorted.length - 1) : 0;
    const bonus = Math.round(4 - ratio * 4);
    points.set(sorted[i].player_id, Math.max(0, Math.min(4, bonus)));
  }

  return points;
}

/**
 * Calculate weekly points for all players who played on a given date.
 * Returns array of { player_id, base_pts, bonus_pts, total_pts }
 */
function calculateWeeklyPoints(eventDate) {
  // Get all scores for this date
  const scores = golfDb.prepare(`
    SELECT s.player_id, s.score, h.handicap_index
    FROM scores s
    JOIN players p ON s.player_id = p.id
    LEFT JOIN handicaps h ON p.id = h.player_id
    WHERE s.date_played = ? AND p.role = 'player' AND (p.archived IS NULL OR p.archived = 0)
  `).all(eventDate);

  if (scores.length === 0) return [];

  // Get flight boundaries
  const flights = getFlightAssignments();
  const lowIds = new Set(flights.low.map(p => p.id));
  const midIds = new Set(flights.mid.map(p => p.id));

  // Group scores by flight
  const lowScores = scores.filter(s => lowIds.has(s.player_id));
  const midScores = scores.filter(s => midIds.has(s.player_id));
  const highScores = scores.filter(s => !lowIds.has(s.player_id) && !midIds.has(s.player_id));

  // Calculate bonus points within each flight
  const lowBonus = calculateBonusPoints(lowScores);
  const midBonus = calculateBonusPoints(midScores);
  const highBonus = calculateBonusPoints(highScores);

  // Combine
  const results = [];
  for (const s of scores) {
    const bonus = lowBonus.get(s.player_id) || midBonus.get(s.player_id) || highBonus.get(s.player_id) || 3;
    results.push({
      player_id: s.player_id,
      base_pts: 3,
      bonus_pts: bonus,
      total_pts: 3 + bonus,
    });
  }

  return results;
}

/**
 * Calculate a player's handicap based on their recent scores.
 * Handicap = average OverPar (score - 36) of best 75% of last 20 scores, rounded to whole number.
 */
function recalculateWaglHandicap(playerId) {
  const scores = golfDb.prepare(
    'SELECT score FROM scores WHERE player_id = ? ORDER BY date_played DESC LIMIT 20'
  ).all(playerId);

  if (scores.length === 0) {
    // Don't delete handicap — keep it persistent
    return null;
  }

  // OverPar values (score - par)
  const overPars = scores.map(s => s.score - PAR);
  overPars.sort((a, b) => a - b);
  const useCount = Math.max(1, Math.ceil(overPars.length * 0.75));
  const best = overPars.slice(0, useCount);
  const avgOverPar = best.reduce((sum, v) => sum + v, 0) / best.length;

  // Handicap = rounded OverPar (NOT par + overpar)
  const handicap = Math.round(avgOverPar);

  // Upsert
  const existing = golfDb.prepare('SELECT id FROM handicaps WHERE player_id = ?').get(playerId);
  if (existing) {
    golfDb.prepare("UPDATE handicaps SET handicap_index = ?, updated_at = datetime('now') WHERE player_id = ?")
      .run(handicap, playerId);
  } else {
    golfDb.prepare('INSERT INTO handicaps (player_id, handicap_index) VALUES (?, ?)')
      .run(playerId, handicap);
  }

  return handicap;
}

module.exports = {
  calculateWaglHandicap,
  getFlightAssignments,
  calculateBonusPoints,
  calculateWeeklyPoints,
  recalculateWaglHandicap,
  PAR,
};
