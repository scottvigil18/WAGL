const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'golf-league-secret-key';

/**
 * Middleware that verifies a JWT Bearer token from the Authorization header.
 * On success, attaches `req.user = { id, role }` and calls next().
 * On failure, returns 401 with { error: "Authentication required" }.
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

/**
 * Middleware that checks if the authenticated user has the 'admin' role.
 * Must be used after authMiddleware.
 * Returns 403 with { error: "Admin access required" } if not admin.
 */
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, JWT_SECRET };
