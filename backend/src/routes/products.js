const router = require('express').Router();
const db = require('../db/schema');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// GET /api/products - public browse with optional filters
// Query params: category, grade, minPrice, maxPrice, seller (farmer name), available (default true), page, limit
router.get('/', (req, res) => {
  const { category, grade, minPrice, maxPrice, seller, available = 'true', page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  let whereSql = `p.quantity > 0`;
  const countParams = [];
  const dataParams = [];

  if (available !== 'true') { 
    whereSql = '1=0'; // No available products
  } else {
    if (category) { 
      whereSql += ` AND p.category = ?`; 
      countParams.push(category); 
      dataParams.push(category); 
    }
    if (grade) { 
      whereSql += ` AND p.grade = ?`; 
      countParams.push(grade); 
      dataParams.push(grade); 
    }
    if (minPrice) { 
      const val = parseFloat(minPrice); 
      whereSql += ` AND p.price >= ?`; 
      countParams.push(val); 
      dataParams.push(val); 
    }
    if (maxPrice) { 
      const val = parseFloat(maxPrice); 
      whereSql += ` AND p.price <= ?`; 
      countParams.push(val); 
      dataParams.push(val); 
    }
    if (seller) { 
      const val = `%${seller}%`; 
      whereSql += ` AND u.name LIKE ?`; 
      countParams.push(val); 
      dataParams.push(val); 
    }
  }

  const countSql = `SELECT COUNT(*) as count FROM products p JOIN users u ON p.farmer_id = u.id WHERE ${whereSql}`;
  const total = db.prepare(countSql).get(...countParams).count;

  const dataSql = `SELECT p.*, u.name as farmer_name FROM products p JOIN users u ON p.farmer_id = u.id WHERE ${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  const products = db.prepare(dataSql).all(...dataParams, limitNum, offset);

  res.json({
    data: products,
    meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum || 1) }
  });
});

// GET /api/products/categories - list distinct categories
router.get('/categories', (req, res) => {
  const rows = db.prepare(`SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category`).all();
  res.json(rows.map(r => r.category));
});

// GET /api/products/mine/list - farmer's own products (must be before /:id)
router.get('/mine/list', auth, (req, res) => {
  if (req.user.role !== 'farmer')
    return res.status(403).json({ error: 'Farmers only' });
  res.json(db.prepare('SELECT * FROM products WHERE farmer_id = ? ORDER BY created_at DESC').all(req.user.id));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, u.name as farmer_name, u.stellar_public_key as farmer_wallet
    FROM products p JOIN users u ON p.farmer_id = u.id WHERE p.id = ?
  `).get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/products - farmer only
router.post('/', auth, validate.product, (req, res) => {
  if (req.user.role !== 'farmer')
    return res.status(403).json({ error: 'Only farmers can list products' });

  const { name, description, unit, category, grade = '' } = req.body;
  const price = parseFloat(req.body.price);
  const quantity = parseInt(req.body.quantity, 10);

  if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
  if (isNaN(price) || price <= 0) return res.status(400).json({ error: 'Price must be a positive number' });
  if (isNaN(quantity) || quantity < 1) return res.status(400).json({ error: 'Quantity must be a positive integer' });

  const result = db.prepare(
    'INSERT INTO products (farmer_id, name, description, category, grade, price, quantity, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, name.trim(), description || '', category || 'other', grade, price, quantity, unit || 'unit');

  res.json({ id: result.lastInsertRowid, message: 'Product listed' });
});

// DELETE /api/products/:id
router.delete('/:id', auth, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND farmer_id = ?').get(req.params.id, req.user.id);
  if (!product) return res.status(404).json({ error: 'Not found or not yours' });
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
