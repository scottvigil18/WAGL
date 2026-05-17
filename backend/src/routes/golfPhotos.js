const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const golfDb = require('../db/golfDatabase');
const { authMiddleware, adminMiddleware } = require('../middleware/golfAuth');

const router = express.Router();

// Photos directory
const PHOTOS_DIR = path.join(__dirname, '../../data/photos');
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1000);
    cb(null, `photo-${req.user.id}-${unique}${ext}`);
  }
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

/**
 * Cleanup expired photos (called on each list request).
 */
function cleanupExpired() {
  const expired = golfDb.prepare(
    "SELECT id, filename FROM photos WHERE expires_at < datetime('now')"
  ).all();

  for (const photo of expired) {
    const filePath = path.join(PHOTOS_DIR, photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    golfDb.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
  }
}

/**
 * GET /api/golf/photos/all/feed
 * List all non-expired photos. Regular users see only approved; admin sees all.
 */
router.get('/all/feed', authMiddleware, (req, res) => {
  try {
    cleanupExpired();
    const isAdmin = req.user.role === 'admin';
    const whereClause = isAdmin
      ? "WHERE ph.expires_at > datetime('now')"
      : "WHERE ph.expires_at > datetime('now') AND (ph.approved = 1 OR ph.player_id = ?)";

    const query = `
      SELECT ph.id, ph.player_id, p.username, p.first_name, p.last_name,
             ph.filename, ph.caption, ph.approved, ph.created_at, ph.expires_at
      FROM photos ph
      JOIN players p ON ph.player_id = p.id
      ${whereClause}
      ORDER BY ph.created_at DESC
    `;

    const photos = isAdmin
      ? golfDb.prepare(query).all()
      : golfDb.prepare(query).all(req.user.id);

    const result = photos.map(ph => ({
      ...ph,
      url: `/api/golf/photos/file/${ph.filename}`,
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/photos/:playerId
 * List all non-expired photos for a player. Requires auth.
 */
router.get('/:playerId', authMiddleware, (req, res) => {
  try {
    cleanupExpired();
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: 'Invalid player ID' });

    const photos = golfDb.prepare(`
      SELECT id, player_id, filename, caption, created_at, expires_at
      FROM photos
      WHERE player_id = ? AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `).all(playerId);

    const result = photos.map(p => ({
      ...p,
      url: `/api/golf/photos/file/${p.filename}`,
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/photos
 * Upload a photo. Auth required — photo belongs to the authenticated user.
 */
router.post('/', authMiddleware, (req, res, next) => {
  photoUpload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const caption = req.body.caption || '';
    const result = golfDb.prepare(
      "INSERT INTO photos (player_id, filename, caption) VALUES (?, ?, ?)"
    ).run(req.user.id, req.file.filename, caption);

    const photo = golfDb.prepare('SELECT * FROM photos WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      ...photo,
      url: `/api/golf/photos/file/${photo.filename}`,
    });
  });
});

/**
 * DELETE /api/golf/photos/:id
 * Delete a photo. Only the owner or an admin can delete.
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const photoId = parseInt(req.params.id, 10);
    if (isNaN(photoId)) return res.status(400).json({ error: 'Invalid photo ID' });

    const photo = golfDb.prepare('SELECT * FROM photos WHERE id = ?').get(photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    // Only owner or admin can delete
    if (photo.player_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this photo' });
    }

    const filePath = path.join(PHOTOS_DIR, photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    golfDb.prepare('DELETE FROM photos WHERE id = ?').run(photoId);

    return res.json({ message: 'Photo deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/photos/pending/count
 * Returns count of pending (unapproved) photos. Admin only.
 */
router.get('/pending/count', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const result = golfDb.prepare(
      "SELECT COUNT(*) AS count FROM photos WHERE approved = 0 AND expires_at > datetime('now')"
    ).get();
    return res.json({ count: result.count });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/photos/:id/approve
 * Approve a pending photo. Admin only.
 */
router.post('/:id/approve', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const photoId = parseInt(req.params.id, 10);
    if (isNaN(photoId)) return res.status(400).json({ error: 'Invalid photo ID' });

    const photo = golfDb.prepare('SELECT id FROM photos WHERE id = ?').get(photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    golfDb.prepare('UPDATE photos SET approved = 1 WHERE id = ?').run(photoId);
    return res.json({ message: 'Photo approved' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/golf/photos/:id/reject
 * Reject (delete) a pending photo. Admin only.
 */
router.post('/:id/reject', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const photoId = parseInt(req.params.id, 10);
    if (isNaN(photoId)) return res.status(400).json({ error: 'Invalid photo ID' });

    const photo = golfDb.prepare('SELECT * FROM photos WHERE id = ?').get(photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const filePath = path.join(PHOTOS_DIR, photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    golfDb.prepare('DELETE FROM photos WHERE id = ?').run(photoId);

    return res.json({ message: 'Photo rejected and deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/golf/photos/file/:filename
 * Serve photo files.
 */
router.get('/file/:filename', (req, res) => {
  const filePath = path.join(PHOTOS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

module.exports = router;
