/**
 * WAGL Data Import & Scoring Implementation
 * Imports 2024 player roster and implements the WAGL scoring system.
 * Run: node import-wagl-data.mjs
 * Remove: node import-wagl-data.mjs --remove
 */

import MDBReader from 'mdb-reader';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const db = require('./src/db/golfDatabase');

const MDB_PATH = 'C:/Users/Dev/source/WAGL App/WAGL2010.mdb';
const IMPORT_PREFIX = 'WAGL_'; // prefix for imported accounts

// Read the MDB
const buf = readFileSync(MDB_PATH);
const mdb = new MDBReader(buf);

function removeImportedData() {
  console.log('Removing all WAGL imported data...');
  const imported = db.prepare("SELECT id FROM players WHERE username LIKE 'WAGL_%'").all();
  if (imported.length === 0) {
    console.log('No imported data found.');
    return;
  }
  const del = db.transaction(() => {
    for (const p of imported) {
      db.prepare('DELETE FROM scores WHERE player_id = ?').run(p.id);
      db.prepare('DELETE FROM handicaps WHERE player_id = ?').run(p.id);
      db.prepare('DELETE FROM players WHERE id = ?').run(p.id);
    }
  });
  del();
  console.log(`Removed ${imported.length} imported players and their data.`);
}

function importData() {
  console.log('=== WAGL Data Import ===\n');

  // Get 2024 players
  const players2024 = mdb.getTable('Players 2024').getData();
  console.log(`Found ${players2024.length} players in 2024 roster.`);

  // Get 2024 scores for handicap reference
  const scores2024 = mdb.getTable('Scores 2024').getData();
  console.log(`Found ${scores2024.length} scores in 2024.`);

  // Get flight cutoffs
  const cutoffs = mdb.getTable('FlightCutoffs').getData()[0];
  console.log(`Flight cutoffs — Low: ${cutoffs.LowHC}, Mid: ${cutoffs.MedHC}`);

  // Import players
  const passwordHash = bcrypt.hashSync('wagl2026', 10);
  const insertPlayer = db.prepare(
    "INSERT OR IGNORE INTO players (username, password_hash, first_name, last_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?, 'player')"
  );
  const upsertHandicap = db.prepare(
    'INSERT OR REPLACE INTO handicaps (player_id, handicap_index) VALUES (?, ?)'
  );

  const playerMap = {}; // MDB PlayerID -> SQLite player id

  const importPlayers = db.transaction(() => {
    for (const p of players2024) {
      const firstName = (p['First Name'] || '').trim();
      const lastName = (p['Last Name'] || '').trim();
      if (!firstName || !lastName || lastName === 'Vacant') continue;

      const username = `${IMPORT_PREFIX}${firstName}${lastName.charAt(0)}`;
      insertPlayer.run(
        username, passwordHash, firstName, lastName,
        '', '' // no email/phone for imported accounts
      );

      const dbPlayer = db.prepare('SELECT id FROM players WHERE username = ?').get(username);
      if (dbPlayer) {
        playerMap[p.PlayerID] = dbPlayer.id;

        // Set handicap from 2024 data
        if (p.Handicap != null) {
          upsertHandicap.run(dbPlayer.id, Math.round(p.Handicap * 10) / 10);
        }
      }
    }
  });

  importPlayers();
  console.log(`\nImported ${Object.keys(playerMap).length} players.`);

  // Import 2024 scores (convert OverPar to actual score: par 36 + overpar)
  const PAR = 36;
  const insertScore = db.prepare(
    'INSERT OR IGNORE INTO scores (player_id, score, holes, date_played) VALUES (?, ?, 9, ?)'
  );

  let scoreCount = 0;
  const importScores = db.transaction(() => {
    for (const s of scores2024) {
      const playerId = playerMap[s.PlayerID];
      if (!playerId) continue;

      const overPar = parseInt(s.OverPar, 10);
      if (isNaN(overPar)) continue;

      const score = PAR + overPar;
      const date = s.Date instanceof Date
        ? s.Date.toISOString().slice(0, 10)
        : String(s.Date).slice(0, 10);

      try {
        insertScore.run(playerId, score, date);
        scoreCount++;
      } catch (e) {
        // Skip duplicates
      }
    }
  });

  importScores();
  console.log(`Imported ${scoreCount} scores from 2024 season.`);

  // Calculate and display flight assignments
  console.log('\n=== Flight Assignments (based on 2024 handicaps) ===');
  const allPlayers = db.prepare(`
    SELECT p.id, p.username, p.first_name, p.last_name, h.handicap_index
    FROM players p
    LEFT JOIN handicaps h ON p.id = h.player_id
    WHERE p.username LIKE 'WAGL_%' AND h.handicap_index IS NOT NULL
    ORDER BY h.handicap_index ASC
  `).all();

  const third = Math.ceil(allPlayers.length / 3);
  console.log(`\nFlight 1 (Low) — top ${third} players:`);
  for (let i = 0; i < third && i < allPlayers.length; i++) {
    console.log(`  ${allPlayers[i].first_name} ${allPlayers[i].last_name} — HC: ${allPlayers[i].handicap_index}`);
  }
  console.log(`\nFlight 2 (Mid) — middle ${third} players:`);
  for (let i = third; i < third * 2 && i < allPlayers.length; i++) {
    console.log(`  ${allPlayers[i].first_name} ${allPlayers[i].last_name} — HC: ${allPlayers[i].handicap_index}`);
  }
  console.log(`\nFlight 3 (High) — bottom ${allPlayers.length - third * 2} players:`);
  for (let i = third * 2; i < allPlayers.length; i++) {
    console.log(`  ${allPlayers[i].first_name} ${allPlayers[i].last_name} — HC: ${allPlayers[i].handicap_index}`);
  }

  console.log('\n=== Scoring System ===');
  console.log('Base points: 3 (for playing)');
  console.log('Bonus points: 3-7 (based on performance within flight)');
  console.log('Total weekly: 6-10 points possible');
  console.log('\n✅ Import complete!');
  console.log('   All imported accounts use password: wagl2026');
  console.log('   To remove: node import-wagl-data.mjs --remove');
}

// Run
if (process.argv.includes('--remove')) {
  removeImportedData();
} else {
  importData();
}
