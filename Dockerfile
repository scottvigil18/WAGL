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

# Copy existing data (database, avatars, photos)
COPY backend/data ./backend/data

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Ensure data directories exist
RUN mkdir -p /app/backend/data/avatars /app/backend/data/photos

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
