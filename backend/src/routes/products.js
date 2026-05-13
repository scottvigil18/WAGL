const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Helper: parse features JSON and attach reviews to a product row
function formatProduct(row) {
  if (!row) return null;
  return {
    ...row,
    original_price: row.original_price ?? null,
    badge: row.badge ?? null,
    image_url: row.image_url ?? null,
    features: JSON.parse(row.features || '[]'),
  };
}

// GET /api/products — list all products (no reviews)
router.get('/', (req, res) => {
  try {
    const { search, sort, category } = req.query;

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ?)';
      const term = `%${search.toLowerCase()}%`;
      params.push(term, term);
    }

    if (category) {
      sql += ' AND LOWER(category) = ?';
      params.push(category.toLowerCase());
    }

    if (sort === 'price-asc')  sql += ' ORDER BY price ASC';
    else if (sort === 'price-desc') sql += ' ORDER BY price DESC';
    else if (sort === 'name-asc')   sql += ' ORDER BY name ASC';
    else sql += ' ORDER BY id ASC';

    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(formatProduct));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/categories — distinct category list
router.get('/categories', (req, res) => {
  try {
    const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
    res.json(rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/products/:id — single product with reviews
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid product id' });

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const reviews = db.prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC').all(id);

    res.json({ ...formatProduct(product), reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

module.exports = router;
