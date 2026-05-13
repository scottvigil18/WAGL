# Project Structure

```
ecommerce-site/
├── backend/                  # Node.js + Express REST API (CommonJS)
│   ├── data/
│   │   └── shopmart.db       # SQLite database (auto-created, gitignored)
│   └── src/
│       ├── db/
│       │   ├── database.js   # DB singleton — connects, applies schema, exports db
│       │   ├── schema.sql    # Table definitions (products, reviews, cart_items)
│       │   └── seed.js       # Seeds 20 products + reviews (safe to re-run)
│       ├── routes/
│       │   ├── products.js   # GET /api/products, /categories, /:id
│       │   └── cart.js       # GET/POST/PATCH/DELETE /api/cart
│       └── index.js          # Express app entry — middleware, routes, health check
│
├── frontend/                 # React 19 + Vite SPA (ESM)
│   └── src/
│       ├── api/              # Thin fetch wrappers — one file per resource
│       │   ├── cartApi.js
│       │   └── productsApi.js
│       ├── components/       # Shared UI components
│       │   ├── Navbar.jsx
│       │   ├── Stars.jsx     # Star rating display
│       │   └── Toast.jsx     # Notification toast
│       ├── pages/            # Top-level route components
│       │   ├── HomePage.jsx
│       │   ├── ProductPage.jsx
│       │   └── CartPage.jsx
│       ├── utils/
│       │   └── session.js    # getOrCreateSessionId() — localStorage helper
│       ├── App.jsx           # Root component: hash router + cart state
│       ├── App.css
│       ├── index.css         # Global styles
│       └── main.jsx          # React DOM entry point
│
└── README.md
```

## Conventions

### Backend
- One router file per resource in `routes/` — import `db` from `../db/database`
- Use `db.prepare(sql).all()` / `.get()` / `.run()` — all DB calls are synchronous
- Wrap route handlers in `try/catch`, return `{ error: '...' }` with appropriate status on failure
- Validate and parse path params (e.g., `parseInt`, `isNaN` check) before querying

### Frontend
- Pages receive props from `App.jsx` — `sessionId`, `onCartChange`, and resource-specific data
- API calls live in `src/api/` — pages/components import from there, never call `fetch` directly
- Navigation uses `navigate(hash)` exported from `App.jsx` (sets `window.location.hash`)
- Cart state is owned by `App.jsx` and passed down; call `onCartChange()` after any mutation
- Session ID is always sourced from `getOrCreateSessionId()` in `utils/session.js`
- All cart API requests must include the `x-session-id` header (handled by `cartApi.js`)
