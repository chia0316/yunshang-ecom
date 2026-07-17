const express = require('express');
const router = express.Router();

const OrderDetail = require('../productModels/OrderDetail.model');
const Product = require('../productModels/Product.model');
const Order = require('../productModels/Order.model');
const { authenticate } = require('../utils/authenticator');

router.get('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const rows = await OrderDetail.findAll();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/order/:oid', authenticate, async (req, res) => {
  const { oid } = req.params;
  try {
    const order = await Order.findByPk(oid);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!req.isAdmin && order.user_id != req.userId) {
      return res.status(403).json({ error: 'Unauthorized request' });
    }
    const rows = await OrderDetail.findAll({
      where: { order_id: oid },
      include: [{ model: Product, attributes: ['name', 'price', 'sku', 'image_filenames'] }]
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
