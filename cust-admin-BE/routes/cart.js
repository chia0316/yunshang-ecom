const express = require('express');
const router = express.Router();

const CartItem = require('../productModels/CartItem.model');
const Product = require('../productModels/Product.model');
const { authenticate } = require('../utils/authenticator');

// Server-backed cart for logged-in customers — mirrors how the wishlist
// works (tied to the account, not the browser), so it survives across
// devices and logging out/back in. Guests still use localStorage only,
// merged in here via /merge once they log in.
router.get('/', authenticate, async (req, res) => {
  try {
    const items = await CartItem.findAll({
      where: { user_id: req.userId },
      include: [{ model: Product }]
    });
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  const { product_id, quantity } = req.body;
  if (!product_id) {
    return res.status(400).json({ error: 'product_id is required' });
  }
  try {
    const [item, created] = await CartItem.findOrCreate({
      where: { user_id: req.userId, product_id },
      defaults: { quantity: quantity || 1 }
    });
    if (!created) {
      await item.increment('quantity', { by: quantity || 1 });
    }
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Called once right after login — sums the guest cart's quantities into
// whatever the account cart already has, rather than overwriting it.
router.post('/merge', authenticate, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }
  try {
    await Promise.all(
      items.map(async (entry) => {
        if (!entry.product_id || !entry.quantity) return;
        const [row, created] = await CartItem.findOrCreate({
          where: { user_id: req.userId, product_id: entry.product_id },
          defaults: { quantity: entry.quantity }
        });
        if (!created) {
          await row.increment('quantity', { by: entry.quantity });
        }
      })
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:productId', authenticate, async (req, res) => {
  const { quantity } = req.body;
  if (typeof quantity !== 'number') {
    return res.status(400).json({ error: 'quantity must be a number' });
  }
  try {
    if (quantity <= 0) {
      await CartItem.destroy({
        where: { user_id: req.userId, product_id: req.params.productId }
      });
      return res.json({ success: true });
    }
    const updated = await CartItem.update(
      { quantity },
      { where: { user_id: req.userId, product_id: req.params.productId } }
    );
    if (updated[0] === 0) {
      return res.status(404).json({ error: 'Item not in cart' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:productId', authenticate, async (req, res) => {
  try {
    await CartItem.destroy({
      where: { user_id: req.userId, product_id: req.params.productId }
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/', authenticate, async (req, res) => {
  try {
    await CartItem.destroy({ where: { user_id: req.userId } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
