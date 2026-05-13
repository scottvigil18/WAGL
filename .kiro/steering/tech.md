# Tech Stack

## Frontend

- **Framework**: React 19 (JSX, functional components, hooks only — no class components)
- **Build tool**: Vite 8
- **Routing**: Custom hash-based router (`window.location.hash`) — no React Router
- **Styling**: Plain CSS (`index.css`, `App.css`) — no CSS-in-JS or utility frameworks
- **Linting**: ESLint with `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`
- **Module format**: ESM (`"type": "module"`)

## Backend

- **Runtime**: Node.js
- **Framework**: Express 4
- **Database**: SQLite via `better-sqlite3` (synchronous API — no async/await for DB calls)
- **CORS**: Configured for `localhost:5173` and `localhost:3000`
- **Module format**: CommonJS (`require`/`module.exports`)

## Database

- SQLite file at `backend/data/shopmart.db`
- WAL mode enabled, foreign keys enforced
- Schema auto-applied on startup via `database.js`
- `features` column on products is a JSON array stored as TEXT — always `JSON.parse` on read

## Common Commands

### Backend
```bash
cd backend
npm start          # production server on http://localhost:4000
npm run dev        # dev server with nodemon (auto-restart)
npm run seed       # seed/re-seed the database with 20 products + reviews
```

### Frontend
```bash
cd frontend
npm run dev        # dev server on http://localhost:5173 (proxies /api to :4000)
npm run build      # production build to frontend/dist/
npm run preview    # preview production build
npm run lint       # run ESLint
```

## API Proxy

Vite proxies `/api/*` requests to `http://localhost:4000` in dev mode. Frontend API calls use relative paths (e.g., `/api/cart`) — never hardcode the backend port in frontend code.
