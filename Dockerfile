# ─── Stage 1: Build Frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Install backend dependencies only
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Copy backend source
COPY backend/src ./backend/src

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create data directory for SQLite persistence
RUN mkdir -p /app/backend/data

# Environment
ENV NODE_ENV=production
ENV PORT=4000
ENV SERVE_FRONTEND=true

# Expose port
EXPOSE 4000

# Mount point for persistent data (SQLite DB, avatars, photos)
VOLUME ["/app/backend/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

# Start the app
CMD ["node", "backend/src/index.js"]
