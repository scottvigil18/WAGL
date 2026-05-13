# ShopMart — 3-Tier E-Commerce App

A full-stack e-commerce application built with:

| Tier | Technology |
|------|-----------|
| Frontend | React 19 + Vite |
| Backend | Node.js + Express |
| Database | SQLite (via better-sqlite3) |

## Project Structure

```
ecommerce-site/
├── backend/                  # Node.js REST API
│   ├── data/
│   │   └── shopmart.db       # SQLite database (auto-created)
│   └── src/
│       ├── db/
│       │   ├── database.js   # DB connection + schema init
│       │   ├── schema.sql    # Table definitions
│       │   └── seed.js       # Seed 20 products + reviews
│       ├── routes/
│       │   ├── products.js   # GET /api/products, /api/products/:id
│       │   └── cart.js       # GET/POST/PATCH/DELETE /api/cart
│       └── index.js          # Express app entry point
│
├── frontend/                 # React + Vite SPA
│   └── src/
│       ├── api/              # Fetch wrappers for backend
│       ├── components/       # Navbar, Stars, Toast
│       ├── pages/            # HomePage, ProductPage, CartPage
│       ├── utils/            # Session ID helper
│       └── App.jsx           # Hash-based router
│
└── README.md
```

## Quick Start

### 1. Start the Backend

```bash
cd backend
npm install          # already done if you followed setup
node src/db/seed.js  # seed DB (safe to re-run)
npm start            # runs on http://localhost:4000
```

### 2. Start the Frontend

```bash
cd frontend
npm install          # already done if you followed setup
npm run dev          # runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products (supports `?search=`, `?sort=`, `?category=`) |
| GET | `/api/products/categories` | List distinct categories |
| GET | `/api/products/:id` | Single product with reviews |
| GET | `/api/cart` | Get cart items (requires `x-session-id` header) |
| POST | `/api/cart` | Add item `{ product_id, qty }` |
| PATCH | `/api/cart/:productId` | Update qty `{ qty }` |
| DELETE | `/api/cart/:productId` | Remove item |
| DELETE | `/api/cart` | Clear entire cart |

## Pages

- **Home** (`#/`) — Product grid with search, category filter, and sort
- **Product** (`#/product/:id`) — Detail view with features, stock, qty selector, and reviews
- **Cart** (`#/cart`) — Cart items with qty controls, delete, order summary, and checkout
