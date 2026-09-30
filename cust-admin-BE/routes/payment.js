const express = require('express');
const router = express.Router();

const Payment = require('../productModels/Payment.model');
const Order = require('../productModels/Order.model');
const OrderDelivery = require('../productModels/OrderDelivery.model');
const OrderDetail = require('../productModels/OrderDetail.model');
const Product = require('../productModels/Product.model');
const User = require('../productModels/User.model');
const { authenticate } = require('../utils/authenticator');
const atome = require('../utils/atome');

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

// Admin-driven status update — this is how a cash payment gets confirmed
// (no gateway webhook exists for Cash). Mirrors what simulate-confirm does
// for the other methods: flipping the parent Order to 'paid' once the
// payment is marked completed, so this behaves the same as a real gateway
// confirmation would.
router.patch('/:pid', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { status, gateway_reference, raw_response } = req.body;
  try {
    const payment = await Payment.findByPk(req.params.pid);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found', success: false });
    }
    const updates = { status, gateway_reference, raw_response };
    if (status === 'completed') updates.paid_at = new Date();
    await payment.update(updates);

    if (status === 'completed') {
      await Order.update({ status: 'paid' }, { where: { id: payment.order_id } });
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

// Starts an Atome checkout for an existing pending Atome Payment (the Order
// + Payment are already created by POST /api/orders, same as PayNow — this
// just gets the redirect URL to send the browser to). Builds the whole
// Atome request from already-persisted rows rather than trusting anything
// from the request body, same discipline as the coupon/discount
// server-recompute in order.js.
router.post('/:pid/atome/checkout', authenticate, async (req, res) => {
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
    if (payment.method !== 'Atome' || payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment is not a pending Atome payment' });
    }

    const [delivery, details, user] = await Promise.all([
      OrderDelivery.findOne({ where: { order_id: order.id } }),
      OrderDetail.findAll({
        where: { order_id: order.id },
        include: [{ model: Product, attributes: ['id', 'name'] }]
      }),
      User.findByPk(order.user_id)
    ]);

    const result = await atome.createCheckout({
      order,
      delivery,
      items: details.map((d) => ({
        product_id: d.product_id,
        name: d.Product?.name || `Item ${d.product_id}`,
        quantity: d.quantity,
        price: d.price
      })),
      customerEmail: user?.email,
      callbackUrl: `${process.env.BACKEND_PUBLIC_URL}/api/payments/atome/webhook`,
      paymentResultUrl: `${process.env.STOREFRONT_URL}/checkout/atome/return?orderId=${order.id}&orderNumber=${order.order_number}`,
      paymentCancelUrl: `${process.env.STOREFRONT_URL}/checkout/atome/return?orderId=${order.id}&orderNumber=${order.order_number}&cancelled=1`
    });

    await payment.update({ gateway_reference: result.referenceId, raw_response: result });
    return res.json({ checkoutUrl: result.redirectUrl });
  } catch (err) {
    console.error('[atome] checkout init failed', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to start Atome checkout' });
  }
});

// Atome's server-to-server callback. Not `authenticate`-gated — this is
// called by Atome, not a logged-in user. The payload only ever carries a
// `referenceId` (per Atome's docs); the real status is always re-fetched
// via getStatus() rather than trusted from the callback body, and the
// update is idempotent so redelivery is safe.
router.post('/atome/webhook', async (req, res) => {
  try {
    if (!atome.verifyWebhookSignature(req.rawBody, req.get('X-Signature'))) {
      console.warn('[atome] webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const { referenceId } = req.body || {};
    if (!referenceId) {
      return res.status(400).json({ error: 'referenceId missing' });
    }

    const payment = await Payment.findOne({ where: { gateway_reference: referenceId } });
    if (!payment) {
      console.warn(`[atome] webhook for unknown referenceId ${referenceId}`);
      return res.status(200).json({ received: true });
    }

    const atomePayment = await atome.getStatus(referenceId);
    const nextStatus = atome.mapStatus(atomePayment.status);

    if (payment.status === nextStatus) {
      return res.status(200).json({ received: true });
    }

    const updates = { status: nextStatus, raw_response: atomePayment };
    if (nextStatus === 'completed') updates.paid_at = new Date();
    await payment.update(updates);

    if (nextStatus === 'completed') {
      await Order.update({ status: 'paid' }, { where: { id: payment.order_id } });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[atome] webhook handling failed', err.response?.data || err.message);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
});

// Admin-triggered refund — only ever for a completed Atome payment. Cash
// and PayNow have no refund action today; this intentionally doesn't add
// one for them.
router.post('/:pid/atome/refund', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const payment = await Payment.findByPk(req.params.pid);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    if (payment.method !== 'Atome' || payment.status !== 'completed') {
      return res.status(400).json({ error: 'Payment is not a completed Atome payment' });
    }

    const result = await atome.refund({
      referenceId: payment.gateway_reference,
      refundId: `REFUND-${payment.id}-${Date.now()}`,
      refundAmount: req.body?.refundAmount ?? payment.amount
    });

    await payment.update({ status: atome.mapStatus(result.status), raw_response: result });
    return res.json({ payment });
  } catch (err) {
    console.error('[atome] refund failed', err.response?.data || err.message);
    return res.status(500).json({ error: 'Refund failed' });
  }
});

module.exports = router;
