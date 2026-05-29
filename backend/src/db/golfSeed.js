const bcrypt = require('bcryptjs');
const golfDb = require('./golfDatabase');

/**
 * Seeds a default admin account into the golf database.
 * Idempotent — only inserts if no admin user exists.
 */
function seedAdmin() {
  const existingAdmin = golfDb.prepare(
    "SELECT id FROM players WHERE username = 'admin'"
  ).get();

  if (existingAdmin) {
    // Ensure the admin account has the correct role
    golfDb.prepare("UPDATE players SET role = 'admin' WHERE username = 'admin'").run();
    return;
  }

  const passwordHash = bcrypt.hashSync('admin123', 10);

  golfDb.prepare(
    "INSERT OR IGNORE INTO players (username, password_hash, role) VALUES (?, ?, 'admin')"
  ).run('admin', passwordHash);
}

/**
 * Seeds golf courses for Weber County and Davis County, Utah.
 * Idempotent — inserts if no courses exist, then backfills par values.
 */
function seedCourses() {
  const existing = golfDb.prepare('SELECT COUNT(*) AS count FROM courses').get();

  if (existing.count === 0) {
    const courses = [
      // Weber County — 9-hole courses only have par_front (the 9 holes played)
      { name: 'El Monte Golf Course',            county: 'Weber', course_rating: 32.4, slope_rating: 104, holes: 9,  par_front: 35, par_back: 35 },
      { name: 'The Barn Golf Club',               county: 'Weber', course_rating: 70.2, slope_rating: 121, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Mount Ogden Golf Course',          county: 'Weber', course_rating: 69.8, slope_rating: 123, holes: 18, par_front: 36, par_back: 35 },
      { name: "Schneiter's Riverside Golf Course",county: 'Weber', course_rating: 68.5, slope_rating: 116, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Wolf Creek Resort Golf Course',    county: 'Weber', course_rating: 71.4, slope_rating: 130, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Eagle Lake Golf Course',           county: 'Weber', course_rating: 34.1, slope_rating: 113, holes: 9,  par_front: 36, par_back: 36 },
      { name: 'Remuda Golf Course',               county: 'Weber', course_rating: 33.8, slope_rating: 110, holes: 9,  par_front: 36, par_back: 36 },
      // Davis County
      { name: 'Bountiful Ridge Golf Club',        county: 'Davis', course_rating: 71.3, slope_rating: 127, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Crane Field Golf Course',          county: 'Davis', course_rating: 70.1, slope_rating: 122, holes: 18, par_front: 36, par_back: 35 },
      { name: 'Davis Park Golf Course',           county: 'Davis', course_rating: 69.5, slope_rating: 119, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Eaglewood Golf Course',            county: 'Davis', course_rating: 70.8, slope_rating: 125, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Glen Eagle Golf Club',             county: 'Davis', course_rating: 71.0, slope_rating: 124, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Hubbard Memorial Golf Course',     county: 'Davis', course_rating: 69.0, slope_rating: 118, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Lakeside Golf Course',             county: 'Davis', course_rating: 68.2, slope_rating: 114, holes: 18, par_front: 36, par_back: 36 },
      { name: "Schneiter's Bluff Golf Course",    county: 'Davis', course_rating: 69.9, slope_rating: 120, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Sun Hills Golf Course',            county: 'Davis', course_rating: 70.5, slope_rating: 126, holes: 18, par_front: 36, par_back: 36 },
      { name: 'Valley View Golf Course',          county: 'Davis', course_rating: 69.0, slope_rating: 118, holes: 18, par_front: 36, par_back: 36 },
    ];

    const insert = golfDb.prepare(
      'INSERT INTO courses (name, county, course_rating, slope_rating, holes, par_front, par_back) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertMany = golfDb.transaction((items) => {
      for (const c of items) {
        insert.run(c.name, c.county, c.course_rating, c.slope_rating, c.holes, c.par_front, c.par_back);
      }
    });
    insertMany(courses);
  } else {
    // Backfill par values for existing courses that still have defaults
    const parMap = {
      'El Monte Golf Course':             { par_front: 35, par_back: 35 },
      'The Barn Golf Club':               { par_front: 36, par_back: 36 },
      'Mount Ogden Golf Course':          { par_front: 36, par_back: 35 },
      "Schneiter's Riverside Golf Course":{ par_front: 36, par_back: 36 },
      'Wolf Creek Resort Golf Course':    { par_front: 36, par_back: 36 },
      'Eagle Lake Golf Course':           { par_front: 36, par_back: 36 },
      'Remuda Golf Course':               { par_front: 36, par_back: 36 },
      'Bountiful Ridge Golf Club':        { par_front: 36, par_back: 36 },
      'Crane Field Golf Course':          { par_front: 36, par_back: 35 },
      'Davis Park Golf Course':           { par_front: 36, par_back: 36 },
      'Eaglewood Golf Course':            { par_front: 36, par_back: 36 },
      'Glen Eagle Golf Club':             { par_front: 36, par_back: 36 },
      'Hubbard Memorial Golf Course':     { par_front: 36, par_back: 36 },
      'Lakeside Golf Course':             { par_front: 36, par_back: 36 },
      "Schneiter's Bluff Golf Course":    { par_front: 36, par_back: 36 },
      'Sun Hills Golf Course':            { par_front: 36, par_back: 36 },
      'Valley View Golf Course':          { par_front: 36, par_back: 36 },
    };
    const update = golfDb.prepare('UPDATE courses SET par_front = ?, par_back = ? WHERE name = ?');
    const backfill = golfDb.transaction(() => {
      for (const [name, par] of Object.entries(parMap)) {
        update.run(par.par_front, par.par_back, name);
      }
    });
    backfill();
  }
}

module.exports = { seedAdmin, seedCourses };
