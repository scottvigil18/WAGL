-- Products table
CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  emoji         TEXT    NOT NULL,
  image_url     TEXT,
  category      TEXT    NOT NULL,
  price         REAL    NOT NULL,
  original_price REAL,
  rating        REAL    NOT NULL DEFAULT 0,
  stock         INTEGER NOT NULL DEFAULT 0,
  badge         TEXT,
  description   TEXT    NOT NULL,
  features      TEXT    NOT NULL  -- JSON array stored as text
);

-- Product reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  date       TEXT    NOT NULL,
  comment    TEXT    NOT NULL
);

-- Shopping cart table (session-based, keyed by session_id)
CREATE TABLE IF NOT EXISTS cart_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT    NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty        INTEGER NOT NULL DEFAULT 1 CHECK(qty > 0),
  UNIQUE(session_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
