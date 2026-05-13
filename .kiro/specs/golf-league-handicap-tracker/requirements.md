# Requirements Document

## Introduction

The Golf League Handicap Tracker is a web application for managing a 50-member golf league. It provides user authentication, golf score entry with strict edit controls, and automatic handicap calculation. Players can submit their scores once per round and view all league members' most recent scores and handicaps on a shared leaderboard. Only administrators can edit submitted scores. Handicap calculations reference the kagglehub dataset (fletcherkennamer/grandpa-golf) for formula calibration.

The system is built as a module within the existing ShopMart infrastructure, using the Node.js/Express backend with SQLite for data persistence and a React/Vite frontend for the user interface. A Python utility handles handicap calculation using the kagglehub dataset.

## Glossary

- **League_App**: The golf league handicap tracker web application as a whole.
- **Auth_Service**: The backend authentication module that handles user registration, login, and session management.
- **Player**: A registered league member who can log in, submit scores, and view the leaderboard.
- **Admin**: A privileged user who can edit any Player's submitted scores and manage league members.
- **Score_Entry**: A single golf score submission by a Player for a specific round, including the date played and the score value.
- **Leaderboard**: The frontend view displaying all Players' most recent scores and calculated handicaps.
- **Handicap_Calculator**: The Python utility that computes a Player's handicap index based on their score history and the kagglehub dataset reference data.
- **Round**: A single game of golf played by one or more Players on a specific date.
- **Handicap_Index**: A numerical value representing a Player's scoring ability, calculated from their recent score history.
- **Score_API**: The backend REST API endpoints for submitting, retrieving, and (admin-only) editing golf scores.
- **User_API**: The backend REST API endpoints for user registration, login, and profile management.

---

## Requirements

### Requirement 1: User Registration

**User Story:** As a league organizer, I want players to register with a username and password, so that each member has a unique identity in the system.

#### Acceptance Criteria

1. THE User_API SHALL expose a `POST /api/golf/register` endpoint that accepts a JSON body containing `username` (string) and `password` (string).
2. WHEN a valid registration request is received with a unique username, THE User_API SHALL create a new Player record and return HTTP 201 with the Player's `id` and `username`.
3. IF the provided username already exists in the database, THEN THE User_API SHALL return HTTP 409 with a JSON error body `{ "error": "Username already exists" }`.
4. IF the `username` field is missing, empty, or shorter than 3 characters, THEN THE User_API SHALL return HTTP 400 with a JSON error body describing the validation failure.
5. IF the `password` field is missing, empty, or shorter than 6 characters, THEN THE User_API SHALL return HTTP 400 with a JSON error body describing the validation failure.
6. THE User_API SHALL store passwords as bcrypt hashes, never in plain text.
7. THE League_App SHALL support a maximum of 50 registered Players.
8. IF a registration request is received when 50 Players already exist, THEN THE User_API SHALL return HTTP 403 with a JSON error body `{ "error": "League is full" }`.

---

### Requirement 2: User Authentication

**User Story:** As a player, I want to log in with my username and password, so that I can access the league system and submit my scores.

#### Acceptance Criteria

1. THE User_API SHALL expose a `POST /api/golf/login` endpoint that accepts a JSON body containing `username` (string) and `password` (string).
2. WHEN valid credentials are provided, THE User_API SHALL return HTTP 200 with a JSON body containing a session token, the Player's `id`, `username`, and `role` (either "player" or "admin").
3. IF the username does not exist in the database, THEN THE User_API SHALL return HTTP 401 with a JSON error body `{ "error": "Invalid credentials" }`.
4. IF the password does not match the stored hash for the given username, THEN THE User_API SHALL return HTTP 401 with a JSON error body `{ "error": "Invalid credentials" }`.
5. THE Auth_Service SHALL generate a JSON Web Token (JWT) as the session token with an expiration time of 24 hours.
6. THE Auth_Service SHALL include the Player's `id` and `role` in the JWT payload.

---

### Requirement 3: Role-Based Access Control

**User Story:** As a league administrator, I want distinct roles for players and admins, so that only authorized users can edit scores.

#### Acceptance Criteria

1. THE League_App SHALL support two roles: "player" and "admin".
2. THE Auth_Service SHALL validate the JWT token on every protected API request by reading it from the `Authorization` header in Bearer format.
3. IF a request to a protected endpoint is missing a valid JWT token, THEN THE Auth_Service SHALL return HTTP 401 with a JSON error body `{ "error": "Authentication required" }`.
4. IF a request to an admin-only endpoint is made by a Player with the "player" role, THEN THE Auth_Service SHALL return HTTP 403 with a JSON error body `{ "error": "Admin access required" }`.
5. THE League_App SHALL have at least one Admin account seeded in the database on initial setup.

---

### Requirement 4: Score Submission

**User Story:** As a player, I want to submit my golf score after a round, so that my performance is recorded and my handicap can be calculated.

#### Acceptance Criteria

1. THE Score_API SHALL expose a `POST /api/golf/scores` endpoint that accepts a JSON body containing `score` (integer) and `date_played` (ISO 8601 date string).
2. WHEN a valid score submission is received from an authenticated Player, THE Score_API SHALL create a new Score_Entry linked to that Player and return HTTP 201 with the created Score_Entry.
3. THE Score_API SHALL associate the Score_Entry with the authenticated Player using the Player ID from the JWT token.
4. IF the Player has already submitted a Score_Entry for the same `date_played`, THEN THE Score_API SHALL return HTTP 409 with a JSON error body `{ "error": "Score already submitted for this date" }`.
5. IF the `score` field is missing, not an integer, or outside the range of 50 to 150, THEN THE Score_API SHALL return HTTP 400 with a JSON error body describing the validation failure.
6. IF the `date_played` field is missing or not a valid ISO 8601 date, THEN THE Score_API SHALL return HTTP 400 with a JSON error body describing the validation failure.
7. WHEN a Score_Entry is successfully created, THE Score_API SHALL trigger a recalculation of the Player's Handicap_Index.

---

### Requirement 5: Score Edit Restriction

**User Story:** As a league organizer, I want submitted scores to be immutable for players but editable by admins, so that score integrity is maintained while allowing corrections when needed.

#### Acceptance Criteria

1. THE Score_API SHALL expose a `PUT /api/golf/scores/:id` endpoint that accepts a JSON body containing `score` (integer) and optionally `date_played` (ISO 8601 date string).
2. WHEN an Admin makes a valid edit request, THE Score_API SHALL update the Score_Entry and return HTTP 200 with the updated Score_Entry.
3. IF a Player with the "player" role attempts to access `PUT /api/golf/scores/:id`, THEN THE Score_API SHALL return HTTP 403 with a JSON error body `{ "error": "Admin access required" }`.
4. IF the Score_Entry ID does not exist, THEN THE Score_API SHALL return HTTP 404 with a JSON error body `{ "error": "Score not found" }`.
5. WHEN a Score_Entry is successfully updated by an Admin, THE Score_API SHALL trigger a recalculation of the affected Player's Handicap_Index.
6. THE Score_API SHALL NOT expose a `DELETE` endpoint for Score_Entries to any role.

---

### Requirement 6: Leaderboard Display

**User Story:** As a player, I want to see all league members' most recent scores and handicaps, so that I can track my standing relative to other players.

#### Acceptance Criteria

1. THE Score_API SHALL expose a `GET /api/golf/leaderboard` endpoint that returns an array of all Players with their most recent Score_Entry and current Handicap_Index.
2. WHEN the leaderboard is requested, THE Score_API SHALL return each Player's `username`, most recent `score`, `date_played`, and `handicap_index`.
3. THE Score_API SHALL sort the leaderboard by Handicap_Index in ascending order (lowest handicap first).
4. WHEN a Player has no Score_Entries, THE Score_API SHALL include that Player in the leaderboard with null values for `score`, `date_played`, and `handicap_index`.
5. THE Leaderboard frontend component SHALL display all Players in a table format with columns for rank, username, most recent score, date played, and handicap index.
6. THE Leaderboard frontend component SHALL be read-only for all users regardless of role.
7. THE Leaderboard frontend component SHALL refresh data on page load and provide a manual refresh button.

---

### Requirement 7: Handicap Calculation

**User Story:** As a player, I want my handicap to be automatically calculated from my score history, so that I have an accurate measure of my playing ability.

#### Acceptance Criteria

1. THE Handicap_Calculator SHALL be implemented as a Python script located in a `golf-handicap/` directory at the project root.
2. THE Handicap_Calculator SHALL use the kagglehub package to download the `fletcherkennamer/grandpa-golf` dataset for reference course data.
3. THE Handicap_Calculator SHALL expose an HTTP endpoint `POST /api/handicap/calculate` that accepts a JSON body containing `scores` (array of integers) and `course_rating` (number) and `slope_rating` (number).
4. WHEN the calculate endpoint is called with valid input, THE Handicap_Calculator SHALL compute the Handicap_Index using the USGA formula: average of best differentials where differential = (score - course_rating) × 113 / slope_rating.
5. THE Handicap_Calculator SHALL use the best 8 differentials out of the most recent 20 scores when 20 or more scores are available.
6. WHEN fewer than 20 scores are available, THE Handicap_Calculator SHALL use the appropriate number of best differentials according to the USGA lookup table (e.g., best 1 of 3-4 scores, best 2 of 5-6 scores, etc.).
7. IF fewer than 3 scores are provided, THEN THE Handicap_Calculator SHALL return a null Handicap_Index with a message indicating insufficient data.
8. THE Handicap_Calculator SHALL include a `requirements.txt` file listing `kagglehub` and other Python dependencies with pinned versions.
9. THE Handicap_Calculator SHALL run within a Python virtual environment as specified by project conventions.

---

### Requirement 8: Player Score History

**User Story:** As a player, I want to view my own score history, so that I can track my improvement over time.

#### Acceptance Criteria

1. THE Score_API SHALL expose a `GET /api/golf/scores/me` endpoint that returns all Score_Entries for the authenticated Player, ordered by `date_played` descending.
2. WHEN the endpoint is called by an authenticated Player, THE Score_API SHALL return an array of Score_Entry objects each containing `id`, `score`, `date_played`, and `created_at`.
3. THE frontend score history view SHALL display the Player's scores in a chronological list format.
4. THE frontend score history view SHALL be read-only for Players; no edit or delete controls SHALL be rendered for the "player" role.
5. WHILE the user has the "admin" role, THE frontend score history view SHALL display an edit button next to each Score_Entry.

---

### Requirement 9: Frontend Authentication UI

**User Story:** As a player, I want a login and registration interface, so that I can create my account and access the league system.

#### Acceptance Criteria

1. THE League_App frontend SHALL display a login form with fields for username and password and a submit button.
2. THE League_App frontend SHALL display a registration form accessible via a "Register" link on the login page.
3. WHEN a user submits valid login credentials, THE League_App frontend SHALL store the returned JWT token in localStorage and navigate to the leaderboard view.
4. WHEN a user submits a valid registration form, THE League_App frontend SHALL automatically log the user in and navigate to the leaderboard view.
5. IF login or registration fails, THEN THE League_App frontend SHALL display the error message returned by the API below the form.
6. THE League_App frontend SHALL include a logout button that clears the stored JWT token and navigates back to the login form.
7. WHILE no valid JWT token is present in localStorage, THE League_App frontend SHALL redirect all navigation attempts to the login form.

---

### Requirement 10: Database Schema

**User Story:** As a developer, I want a well-defined database schema, so that player, score, and handicap data is stored reliably.

#### Acceptance Criteria

1. THE League_App SHALL store data in a separate SQLite database file at `backend/data/golf_league.db`.
2. THE database schema SHALL include a `players` table with columns: `id` (integer primary key), `username` (text unique not null), `password_hash` (text not null), `role` (text not null default 'player'), and `created_at` (text not null default current timestamp).
3. THE database schema SHALL include a `scores` table with columns: `id` (integer primary key), `player_id` (integer not null foreign key referencing players.id), `score` (integer not null), `date_played` (text not null), and `created_at` (text not null default current timestamp).
4. THE database schema SHALL include a `handicaps` table with columns: `id` (integer primary key), `player_id` (integer not null foreign key referencing players.id), `handicap_index` (real), and `updated_at` (text not null default current timestamp).
5. THE database schema SHALL enforce a unique constraint on `(player_id, date_played)` in the `scores` table to prevent duplicate entries.
6. THE database schema SHALL enable WAL mode and enforce foreign keys on connection.
7. THE database schema SHALL be auto-applied on application startup.

---

### Requirement 11: Golf Course Selection

**User Story:** As a player, I want to select which golf course I played when submitting my score, so that my handicap can be calculated using the correct course rating and slope rating for that course.

#### Acceptance Criteria

1. THE League_App SHALL maintain a predefined list of golf courses from Weber County and Davis County, Utah.
2. THE Score_API SHALL accept a `course_id` field in the score submission request body.
3. WHEN a score is submitted, THE Score_API SHALL use the selected course's course rating and slope rating for handicap calculation instead of default values.
4. THE frontend score submission form SHALL display a dropdown selector listing all available courses grouped by county.
5. THE database schema SHALL include a `courses` table with columns: `id` (integer primary key), `name` (text not null), `county` (text not null), `course_rating` (real not null), `slope_rating` (integer not null), and `holes` (integer not null default 18).
6. THE database schema SHALL include a `course_id` foreign key column in the `scores` table referencing the `courses` table.
7. THE Leaderboard SHALL display the course name alongside each player's most recent score.
8. THE League_App SHALL seed the following Weber County courses on initial setup:
   - El Monte Golf Course (Ogden) — 9 holes
   - Ben Lomond Golf Course (North Ogden)
   - The Barn Golf Club (Pleasant View)
   - Mount Ogden Golf Course (Ogden)
   - Schneiter's Riverside Golf Course (Ogden)
   - Wolf Creek Resort Golf Course (Eden)
   - Eagle Lake Golf Course (South Weber)
   - Remuda Golf Course (Ogden)
9. THE League_App SHALL seed the following Davis County courses on initial setup:
   - Bountiful Ridge Golf Club (Bountiful)
   - Crane Field Golf Course (Clinton)
   - Davis Park Golf Course (Fruit Heights)
   - Eaglewood Golf Course (North Salt Lake)
   - Glen Eagle Golf Club (Syracuse)
   - Lakeside Golf Course (West Bountiful)
   - Schneiter's Bluff Golf Course (West Point)
   - Sun Hills Golf Course (Layton)
   - Valley View Golf Course (Layton)
10. THE Score_API SHALL expose a `GET /api/golf/courses` endpoint that returns all available courses grouped by county.
