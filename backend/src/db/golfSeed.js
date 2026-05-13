const bcrypt = require('bcryptjs');
const golfDb = require('./golfDatabase');

/**
 * Seeds a default admin account into the golf database.
 * Idempotent — only inserts if no admin user exists.
 */
function seedAdmin() {
  const existingAdmin = golfDb.prepare(
    "SELECT id FROM players WHERE role = 'admin'"
  ).get();

  if (existingAdmin) {
    return;
  }

  const passwordHash = bcrypt.hashSync('admin123', 10);

  golfDb.prepare(
    "INSERT INTO players (username, password_hash, role) VALUES (?, ?, 'admin')"
  ).run('admin', passwordHash);
}

/**
 * Seeds golf courses for Weber County and Davis County, Utah.
 * Idempotent — only inserts if no courses exist.
 */
function seedCourses() {
  const existing = golfDb.prepare('SELECT COUNT(*) AS count FROM courses').get();
  if (existing.count > 0) {
    return;
  }

  const courses = [
    // Weber County courses
    { name: 'El Monte Golf Course', county: 'Weber', course_rating: 32.4, slope_rating: 104, holes: 9 },
    { name: 'Ben Lomond Golf Course', county: 'Weber', course_rating: 67.9, slope_rating: 112, holes: 18 },
    { name: 'The Barn Golf Club', county: 'Weber', course_rating: 70.2, slope_rating: 121, holes: 18 },
    { name: 'Mount Ogden Golf Course', county: 'Weber', course_rating: 69.8, slope_rating: 123, holes: 18 },
    { name: "Schneiter's Riverside Golf Course", county: 'Weber', course_rating: 68.5, slope_rating: 116, holes: 18 },
    { name: 'Wolf Creek Resort Golf Course', county: 'Weber', course_rating: 71.4, slope_rating: 130, holes: 18 },
    { name: 'Eagle Lake Golf Course', county: 'Weber', course_rating: 34.1, slope_rating: 113, holes: 9 },
    { name: 'Remuda Golf Course', county: 'Weber', course_rating: 33.8, slope_rating: 110, holes: 9 },

    // Davis County courses
    { name: 'Bountiful Ridge Golf Club', county: 'Davis', course_rating: 71.3, slope_rating: 127, holes: 18 },
    { name: 'Crane Field Golf Course', county: 'Davis', course_rating: 70.1, slope_rating: 122, holes: 18 },
    { name: 'Davis Park Golf Course', county: 'Davis', course_rating: 69.5, slope_rating: 119, holes: 18 },
    { name: 'Eaglewood Golf Course', county: 'Davis', course_rating: 70.8, slope_rating: 125, holes: 18 },
    { name: 'Glen Eagle Golf Club', county: 'Davis', course_rating: 71.0, slope_rating: 124, holes: 18 },
    { name: 'Lakeside Golf Course', county: 'Davis', course_rating: 68.2, slope_rating: 114, holes: 18 },
    { name: "Schneiter's Bluff Golf Course", county: 'Davis', course_rating: 69.9, slope_rating: 120, holes: 18 },
    { name: 'Sun Hills Golf Course', county: 'Davis', course_rating: 70.5, slope_rating: 126, holes: 18 },
    { name: 'Valley View Golf Course', county: 'Davis', course_rating: 69.0, slope_rating: 118, holes: 18 },
  ];

  const insert = golfDb.prepare(
    'INSERT INTO courses (name, county, course_rating, slope_rating, holes) VALUES (?, ?, ?, ?, ?)'
  );

  const insertMany = golfDb.transaction((items) => {
    for (const c of items) {
      insert.run(c.name, c.county, c.course_rating, c.slope_rating, c.holes);
    }
  });

  insertMany(courses);
}

module.exports = { seedAdmin, seedCourses };
