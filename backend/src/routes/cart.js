const express = require('express');
const router = express.Router();
const db = require('../db/database');

// All cart routes require a session_id header or query param
function getSessionId(req) {
  return req.headers['x-session-id'] || req.query.session_id;
}

function requireSession(req, res, next) {
  const sessionId = getSessionId(req);
  if (!sessionId || sessionId.trim() === '') {
    return res.status(400).json({ error: 'Missing x-session-id header' });
  }
  req.sessionId = sessionId.trim();
  next();
}

// Helper: fetch full cart with product details for a session
function getCartWithDetails(sessionId) {
  return db.prepare(`
    SELECT
      ci.id        AS cart_item_id,
      ci.product_id,
      ci.qty,
      p.name,
      p.emoji,
      p.image_url,
      p.category,
      p.price,
      p.original_price,
      p.stock,
      p.badge
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.session_id = ?
    ORDER BY ci.id ASC
  `).all(sessionId);
}

// GET /api/cart — get all cart items for session
router.get('/', requireSession, (req, res) => {
  try {
    const items = getCartWithDetails(req.sessionId);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// POST /api/cart — add item or increment qty
// Body: { product_id, qty? }
router.post('/', requireSession, (req, res) => {
  try {
    const { product_id, qty = 1 } = req.body;

    if (!product_id || isNaN(parseInt(product_id))) {
      return res.status(400).json({ error: 'product_id is required' });
    }
    if (qty < 1) {
      return res.status(400).json({ error: 'qty must be at least 1' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(parseInt(product_id));
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Upsert: if item exists, increment qty; otherwise insert
    const existing = db.prepare(
      'SELECT * FROM cart_items WHERE session_id = ? AND product_id = ?'
    ).get(req.sessionId, product.id);

    if (existing) {
      const newQty = Math.min(existing.qty + qty, product.stock);
      db.prepare('UPDATE cart_items SET qty = ? WHERE id = ?').run(newQty, existing.id);
    } else {
      const clampedQty = Math.min(qty, product.stock);
      db.prepare(
        'INSERT INTO cart_items (session_id, product_id, qty) VALUES (?, ?, ?)'
      ).run(req.sessionId, product.id, clampedQty);
    }

    const items = getCartWithDetails(req.sessionId);
    res.status(200).json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// PATCH /api/cart/:productId — update qty for a specific item
// Body: { qty }
router.patch('/:productId', requireSession, (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const { qty } = req.body;

    if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product id' });
    if (qty === undefined || isNaN(parseInt(qty))) {
      return res.status(400).json({ error: 'qty is required' });
    }

    const parsedQty = parseInt(qty);

    // qty <= 0 means remove
    if (parsedQty <= 0) {
      db.prepare(
        'DELETE FROM cart_items WHERE session_id = ? AND product_id = ?'
      ).run(req.sessionId, productId);
    } else {
      const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const clampedQty = Math.min(parsedQty, product.stock);
      const result = db.prepare(
        'UPDATE cart_items SET qty = ? WHERE session_id = ? AND product_id = ?'
      ).run(clampedQty, req.sessionId, productId);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Cart item not found' });
      }
    }

    const items = getCartWithDetails(req.sessionId);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

// DELETE /api/cart/:productId — remove a specific item
router.delete('/:productId', requireSession, (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product id' });

    db.prepare(
      'DELETE FROM cart_items WHERE session_id = ? AND product_id = ?'
    ).run(req.sessionId, productId);

    const items = getCartWithDetails(req.sessionId);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
});

// DELETE /api/cart — clear entire cart
router.delete('/', requireSession, (req, res) => {
  try {
    db.prepare('DELETE FROM cart_items WHERE session_id = ?').run(req.sessionId);
    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;
