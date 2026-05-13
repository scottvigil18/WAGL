const http = require('http');

/**
 * Calls the Python handicap microservice to calculate a player's handicap index.
 *
 * @param {number[]} scores - Array of golf scores
 * @param {number} courseRating - Course rating (default 72.0)
 * @param {number} slopeRating - Slope rating (default 113)
 * @returns {Promise<{ handicap_index: number|null, differentials_used: number, message: string|null }>}
 */
function calculateHandicap(scores, courseRating, slopeRating) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      scores,
      course_rating: courseRating,
      slope_rating: slopeRating
    });

    const options = {
      hostname: 'localhost',
      port: 5001,
      path: '/api/handicap/calculate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            handicap_index: parsed.handicap_index ?? null,
            differentials_used: parsed.differentials_used ?? 0,
            message: parsed.message ?? null
          });
        } catch (err) {
          resolve({
            handicap_index: null,
            differentials_used: 0,
            message: 'Handicap service returned invalid response'
          });
        }
      });
    });

    req.on('error', () => {
      resolve({
        handicap_index: null,
        differentials_used: 0,
        message: 'Handicap service unavailable'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        handicap_index: null,
        differentials_used: 0,
        message: 'Handicap service unavailable'
      });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = { calculateHandicap };
