const express = require('express');
const cors = require('cors');
const path = require('path');

const golfAuthRoutes = require('./routes/golfAuth');
const golfScoreRoutes = require('./routes/golfScores');
const golfAdminRoutes = require('./routes/golfAdmin');
const golfPhotoRoutes = require('./routes/golfPhotos');
const { seedAdmin, seedCourses } = require('./db/golfSeed');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-session-id', 'Authorization'],
}));

app.use(express.json());

// ─── Golf League Routes ──────────────────────────────────────────────────────
app.use('/api/golf', golfAuthRoutes);
app.use('/api/golf', golfScoreRoutes);
app.use('/api/golf/admin', golfAdminRoutes);
app.use('/api/golf/photos', golfPhotoRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
seedAdmin();
seedCourses();

app.listen(PORT, () => {
  console.log(`⛳ WAGL API running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
