const router = require('express').Router();
const db = require('../db/schema');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendPayment, getBalance } = require('../utils/stellar');
const { sendOrderEmails } = require('../utils/mailer');

// POST /api/orders - buyer places an order; TX submitted async
router.post('/', auth, validate.order, async (req, res) => {
  if (req.user.role !== 'buyer')
    return res.status(403).json({ error: 'Only buyers can place orders' });

  const { product_id } = req.body;
  const quantity = parseInt(req.body.quantity, 10);
  if (!product_id || isNaN(quantity) || quantity < 1)
    return res.status(400).json({ error: 'product_id and a positive quantity are required' });

  const product = db.prepare(`
    SELECT p.*, u.stellar_public_key as farmer_wallet
    FROM products p JOIN users u ON p.farmer_id = u.id
    WHERE p.id = ?
  `).get(product_id);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  const buyer = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const totalPrice = product.price * quantity;

  const balance = await getBalance(buyer.stellar_public_key);
  if (balance < totalPrice + 0.00001)
    return res.status(402).json({
      error: 'Insufficient XLM balance',
      required: (totalPrice + 0.00001).toFixed(7),
      available: balance.toFixed(7),
    });

  const reserveStock = db.transaction((buyerId, productId, qty, total) => {
    const deducted = db.prepare(
      'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?'
    ).run(qty, productId, qty);
    if (deducted.changes === 0) throw new Error('Insufficient stock');
    const order = db.prepare(
      `INSERT INTO orders (buyer_id, product_id, quantity, total_price, status) VALUES (?, ?, ?, ?, 'confirming')`
    ).run(buyerId, productId, qty, total);
    return order.lastInsertRowid;
  });

  let orderId;
  try {
    orderId = reserveStock(req.user.id, product_id, quantity, totalPrice);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Submit TX in background — respond immediately with confirming status
  res.json({ orderId, status: 'confirming', totalPrice });

  try {
    const txHash = await sendPayment({
      senderSecret: buyer.stellar_secret_key,
      receiverPublicKey: product.farmer_wallet,
      amount: totalPrice,
      memo: `Order#${orderId}`,
    });

    db.prepare(
      `UPDATE orders SET status = 'confirming', stellar_tx_hash = ?, tx_submitted_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(txHash, orderId);

    const farmer = db.prepare('SELECT * FROM users WHERE id = ?').get(product.farmer_id);
    sendOrderEmails({
      order: { id: orderId, quantity, total_price: totalPrice, stellar_tx_hash: txHash },
      product, buyer, farmer,
    }).catch(e => console.error('Email failed:', e.message));
  } catch (err) {
    db.prepare(`UPDATE products SET quantity = quantity + ? WHERE id = ?`).run(quantity, product_id);
    db.prepare(`UPDATE orders SET status = 'failed' WHERE id = ?`).run(orderId);
    console.error(`[order ${orderId}] TX submission failed:`, err.message);
  }
});

// GET /api/orders/:id/status - poll order confirmation status
router.get('/:id/status', auth, (req, res) => {
  const order = db.prepare(
    `SELECT id, status, stellar_tx_hash, total_price, tx_submitted_at FROM orders WHERE id = ? AND buyer_id = ?`
  ).get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// GET /api/orders - buyer's order history
router.get('/', auth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, p.name as product_name, p.unit, u.name as farmer_name
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users u ON p.farmer_id = u.id
    WHERE o.buyer_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user.id);
  res.json(orders);
});

// GET /api/orders/sales - farmer's incoming orders
router.get('/sales', auth, (req, res) => {
  if (req.user.role !== 'farmer')
    return res.status(403).json({ error: 'Farmers only' });

  const sales = db.prepare(`
    SELECT o.*, p.name as product_name, u.name as buyer_name
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users u ON o.buyer_id = u.id
    WHERE p.farmer_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user.id);
  res.json(sales);
});

module.exports = router;
