const express = require('express');
const router = express.Router();

const Payment = require('../productModels/Payment.model');
const Order = require('../productModels/Order.model');
const { authenticate } = require('../utils/authenticator');

router.get('/order/:oid', authenticate, async (req, res) => {
  try {
    const rows = await Payment.findAll({
      where: { order_id: req.params.oid },
      order: [['created_at', 'DESC']]
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  const { order_id, amount, currency, method, gateway_reference } = req.body;
  try {
    const payment = await Payment.create({
      order_id,
      amount,
      currency: currency || 'SGD',
      method,
      gateway_reference,
      status: 'pending'
    });
    return res.status(201).json(payment);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:pid', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { status, gateway_reference, raw_response } = req.body;
  try {
    const updates = { status, gateway_reference, raw_response };
    if (status === 'completed') updates.paid_at = new Date();
    const updated = await Payment.update(updates, { where: { id: req.params.pid } });
    if (updated[0] === 0) {
      return res.status(404).json({ message: 'Payment not found', success: false });
    }
    return res.json({ message: 'Payment updated successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// TEMPORARY: stands in for a real payment gateway callback (PayNow/NETS/card
// webhook) until one is integrated. Lets the customer who placed the order
// mark their own pending payment as paid so the checkout flow can be
// exercised end-to-end. Replace with a real gateway webhook handler and
// remove customer self-confirmation once a gateway is wired in.
router.post('/:pid/simulate-confirm', authenticate, async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.pid);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const order = await Order.findByPk(payment.order_id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!req.isAdmin && order.user_id !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized request' });
    }

    await payment.update({
      status: 'completed',
      paid_at: new Date(),
      gateway_reference: payment.gateway_reference || `SIMULATED-${Date.now()}`
    });
    await order.update({ status: 'paid' });

    return res.json({ payment, order });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
