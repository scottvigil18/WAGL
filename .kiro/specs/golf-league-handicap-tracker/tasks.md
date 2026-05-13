# Implementation Plan: Golf League Handicap Tracker

## Overview

This plan implements a golf league management module within the existing ShopMart application. The implementation proceeds bottom-up: database and schema first, then backend auth and score routes, then the Python handicap microservice, and finally the React frontend pages. Each step builds on the previous, ensuring no orphaned code.

## Tasks

- [x] 1. Set up golf database and schema
  - [x] 1.1 Create the golf database module (`backend/src/db/golfDatabase.js`)
    - Create a new better-sqlite3 connection to `backend/data/golf_league.db`
    - Enable WAL mode and foreign keys
    - Read and apply `golfSchema.sql` on startup
    - Export the `golfDb` instance using CommonJS
    - _Requirements: 10.1, 10.6, 10.7_

  - [x] 1.2 Create the golf schema SQL file (`backend/src/db/golfSchema.sql`)
    - Define `players` table with id, username, password_hash, role, created_at
    - Define `scores` table with id, player_id, score, date_played, created_at, and UNIQUE(player_id, date_played)
    - Define `handicaps` table with id, player_id, handicap_index, updated_at
    - Add indexes on scores(player_id), scores(player_id, date_played), handicaps(player_id)
    - Add CHECK constraints: role IN ('player','admin'), score BETWEEN 50 AND 150
    - _Requirements: 10.2, 10.3, 10.4, 10.5_

  - [x] 1.3 Seed an admin account in the golf database (`backend/src/db/golfSeed.js`)
    - Create a seed script that inserts a default admin user (username: "admin", bcrypt-hashed password)
    - Only insert if no admin exists (idempotent)
    - _Requirements: 3.5_

- [x] 2. Implement backend authentication
  - [x] 2.1 Create JWT auth middleware (`backend/src/middleware/golfAuth.js`)
    - Implement `authMiddleware` that reads Bearer token from Authorization header, verifies JWT, attaches `req.user = { id, role }`
    - Implement `adminMiddleware` that checks `req.user.role === 'admin'` and returns 403 if not
    - Return 401 with `{ "error": "Authentication required" }` for missing/invalid tokens
    - Return 403 with `{ "error": "Admin access required" }` for non-admin users on admin routes
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 2.2 Create golf auth routes (`backend/src/routes/golfAuth.js`)
    - Implement `POST /api/golf/register`: validate username (≥3 chars) and password (≥6 chars), check league cap (50), hash password with bcrypt, insert player, return 201 with id and username
    - Implement `POST /api/golf/login`: validate credentials against bcrypt hash, generate JWT with id, role, 24h expiry, return token, id, username, role
    - Handle error cases: 400 validation, 409 duplicate username, 403 league full, 401 invalid credentials
    - _Requirements: 1.1–1.8, 2.1–2.6_

  - [ ]* 2.3 Write property tests for registration (Properties 1–4)
    - **Property 1: Valid registration creates a player**
    - **Property 2: Duplicate username registration is rejected**
    - **Property 3: Invalid registration input is rejected**
    - **Property 4: Passwords are never stored in plain text**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**

  - [ ]* 2.4 Write property tests for authentication (Properties 5–6)
    - **Property 5: Valid credentials produce a correct JWT**
    - **Property 6: Invalid credentials are rejected**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**

  - [ ]* 2.5 Write property tests for authorization (Properties 7–8)
    - **Property 7: Protected endpoints reject unauthenticated requests**
    - **Property 8: Player role cannot access admin endpoints**
    - **Validates: Requirements 3.2, 3.3, 3.4, 5.3**

- [x] 3. Implement score submission and editing
  - [x] 3.1 Create handicap client (`backend/src/services/handicapClient.js`)
    - Implement `calculateHandicap(scores, courseRating, slopeRating)` that POSTs to `http://localhost:5001/api/handicap/calculate`
    - Return `{ handicap_index, differentials_used, message }` on success
    - Handle connection errors gracefully, return 503-style error info
    - _Requirements: 4.7, 5.5_

  - [x] 3.2 Create golf score routes (`backend/src/routes/golfScores.js`)
    - Implement `POST /api/golf/scores`: validate score (integer 50–150) and date_played (ISO 8601), enforce one-per-day uniqueness, insert score, trigger handicap recalculation, return 201
    - Implement `PUT /api/golf/scores/:id`: admin-only, validate input, update score, trigger handicap recalculation, return 200
    - Implement `GET /api/golf/scores/me`: return authenticated player's scores ordered by date_played descending
    - Implement `GET /api/golf/leaderboard`: return all players with most recent score, date_played, and handicap_index sorted by handicap ascending (nulls last)
    - _Requirements: 4.1–4.7, 5.1–5.6, 6.1–6.4, 8.1–8.2_

  - [x] 3.3 Mount golf routes in Express app (`backend/src/index.js`)
    - Import and mount golfAuth routes and golfScores routes
    - Ensure golf routes are registered alongside existing ShopMart routes
    - Run golf seed on startup to ensure admin account exists
    - _Requirements: 1.1, 2.1, 4.1, 6.1_

  - [ ]* 3.4 Write property tests for score submission (Properties 9–11)
    - **Property 9: Valid score submission creates an entry**
    - **Property 10: Duplicate date score submission is rejected**
    - **Property 11: Invalid score values are rejected**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 10.5**

  - [ ]* 3.5 Write property tests for leaderboard and history (Properties 14–15)
    - **Property 14: Leaderboard completeness and sorting**
    - **Property 15: Score history returns correct ordered entries**
    - **Validates: Requirements 6.1, 6.2, 6.3, 8.1, 8.2**

- [x] 4. Checkpoint
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 5. Implement Python handicap service
  - [x] 5.1 Set up Python project structure (`golf-handicap/`)
    - Create `golf-handicap/` directory with `app.py`, `requirements.txt`, and a `README.md`
    - `requirements.txt` should pin: flask, kagglehub, gunicorn, hypothesis, pytest
    - Include instructions for venv setup and activation
    - _Requirements: 7.1, 7.8, 7.9_

  - [x] 5.2 Implement the Flask handicap calculator (`golf-handicap/app.py`)
    - Implement `POST /api/handicap/calculate` endpoint accepting `{ scores, course_rating, slope_rating }`
    - Implement `GET /api/handicap/health` health check endpoint
    - Compute differentials: `(score - course_rating) × 113 / slope_rating`
    - Apply USGA lookup table to determine how many best differentials to average and what adjustment to apply
    - Return null handicap_index with message when fewer than 3 scores provided
    - Load course data from kagglehub dataset with fallback to defaults (72.0 / 113)
    - Validate input: return 400 for missing fields or wrong types
    - Run on port 5001
    - _Requirements: 7.2–7.7_

  - [ ]* 5.3 Write property tests for handicap calculation (Properties 12–13)
    - **Property 12: Handicap differential formula correctness**
    - **Property 13: Handicap uses correct number of differentials per USGA table**
    - Use Hypothesis library for Python property-based testing
    - **Validates: Requirements 7.4, 7.5, 7.6**

- [x] 6. Checkpoint
  - Ensure all backend and Python service tests pass, ask the user if questions arise.

- [x] 7. Implement frontend golf pages
  - [x] 7.1 Create golf API module (`frontend/src/api/golfApi.js`)
    - Implement fetch wrappers for: register, login, getLeaderboard, getMyScores, submitScore, editScore (admin)
    - Attach JWT from localStorage in Authorization header for protected calls
    - Use relative paths (`/api/golf/*`) to leverage Vite proxy
    - _Requirements: 9.3, 9.4_

  - [x] 7.2 Create login and register pages (`frontend/src/pages/GolfLoginPage.jsx`, `frontend/src/pages/GolfRegisterPage.jsx`)
    - Login form with username, password fields and submit button
    - Register form accessible via link from login page
    - On success: store JWT in localStorage, navigate to leaderboard
    - On failure: display API error message below form
    - _Requirements: 9.1–9.5_

  - [x] 7.3 Create leaderboard page (`frontend/src/pages/GolfLeaderboardPage.jsx`)
    - Table with columns: rank, username, most recent score, date played, handicap index
    - Sort by handicap ascending, nulls last
    - Fetch data on mount and provide manual refresh button
    - Read-only for all users
    - _Requirements: 6.5, 6.6, 6.7_

  - [x] 7.4 Create score history page (`frontend/src/pages/GolfScoreHistoryPage.jsx`)
    - Display authenticated player's scores in descending date order
    - Show id, score, date_played, created_at for each entry
    - Read-only for players; show edit button for admin role
    - _Requirements: 8.3, 8.4, 8.5_

  - [x] 7.5 Create score submission form (`frontend/src/components/GolfScoreForm.jsx`)
    - Form with score input (number, 50–150) and date picker
    - Submit calls POST /api/golf/scores
    - Display success/error feedback
    - Prevent double-submission with loading state
    - _Requirements: 4.1, 4.2_

  - [x] 7.6 Create golf navigation component (`frontend/src/components/GolfNav.jsx`)
    - Navigation links: Leaderboard, Submit Score, My History, Logout
    - Logout clears JWT from localStorage and navigates to login
    - _Requirements: 9.6_

  - [x] 7.7 Integrate golf pages into the app router (`frontend/src/App.jsx`)
    - Add hash routes: `#/golf/login`, `#/golf/register`, `#/golf/leaderboard`, `#/golf/scores`, `#/golf/history`
    - Protect golf routes (except login/register) — redirect to login if no JWT present
    - Render GolfNav on all authenticated golf pages
    - _Requirements: 9.7_

  - [ ]* 7.8 Write unit tests for frontend components
    - Test login form renders correctly and handles submission
    - Test leaderboard table renders player data and sorts correctly
    - Test score form validates input range
    - Test auth redirect behavior when JWT is missing
    - _Requirements: 9.1, 6.5, 4.5_

- [x] 8. Final checkpoint
  - Ensure all tests pass across backend, Python service, and frontend, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The backend uses CommonJS (`require`/`module.exports`), the frontend uses ESM
- The Python service runs in a venv on port 5001; the Node backend calls it internally
- All frontend API calls use relative paths to leverage the Vite dev proxy
