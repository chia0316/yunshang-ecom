const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { Op } = require('sequelize');

const Coupon = require('../productModels/Coupon.model');
const { authenticate } = require('../utils/authenticator');
const { resolveCoupon } = require('../utils/coupons');
const validate = require('../utils/validator');

// Public — lets the storefront show a browsable list of currently usable
// promo codes on the cart page, instead of customers having to already know
// a code to try it. Only exposes codes that could actually still be applied
// (active, not expired, under their usage cap) — never used_count/id/etc.
router.get('/available', async (req, res) => {
  try {
    const now = new Date();
    const coupons = await Coupon.findAll({
      where: {
        is_active: true,
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }]
      },
      order: [['created_at', 'DESC']]
    });
    const available = coupons
      .filter((c) => c.max_uses === null || c.used_count < c.max_uses)
      .map((c) => ({
        code: c.code,
        discount_type: c.discount_type,
        discount_value: Number(c.discount_value),
        min_order_amount: c.min_order_amount ? Number(c.min_order_amount) : null,
        remaining_uses: c.max_uses === null ? null : c.max_uses - c.used_count,
        expires_at: c.expires_at
      }));
    return res.json(available);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const coupons = await Coupon.findAll({ order: [['created_at', 'DESC']] });
    return res.json(coupons);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const isValid = await validate.run(req, res, [
    body('code').exists().notEmpty().withMessage('Code cannot be empty'),
    body('discount_type').isIn(['percent', 'fixed']).withMessage('discount_type must be percent or fixed'),
    body('discount_value').isFloat({ gt: 0 }).withMessage('discount_value must be greater than 0')
  ]);
  if (!isValid) {
    return;
  }
  const { code, discount_type, discount_value, min_order_amount, max_uses, expires_at, is_active } = req.body;
  try {
    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discount_type,
      discount_value,
      min_order_amount: min_order_amount || null,
      max_uses: max_uses || null,
      expires_at: expires_at || null,
      is_active: is_active === undefined ? true : is_active
    });
    return res.status(201).json(coupon);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A coupon with this code already exists' });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const allowedFields = [
    'discount_type',
    'discount_value',
    'min_order_amount',
    'max_uses',
    'expires_at',
    'is_active'
  ];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
  );
  try {
    const updated = await Coupon.update(updates, { where: { id: req.params.id } });
    if (updated[0] === 0) {
      return res.status(404).json({ message: 'Coupon not found', success: false });
    }
    return res.json({ message: 'Coupon updated successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const deletedCount = await Coupon.destroy({ where: { id: req.params.id } });
    if (deletedCount === 0) {
      return res.status(404).json({ message: 'Coupon not found', success: false });
    }
    return res.json({ message: 'Coupon deleted successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Public — cart/checkout calls this to preview the discount before placing
// the order. Order creation re-validates independently (see routes/order.js)
// so this endpoint being public carries no risk of an unearned discount.
router.post('/validate', async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code || subtotal === undefined) {
    return res.status(400).json({ error: 'code and subtotal are required' });
  }
  try {
    const { coupon, discountAmount, error } = await resolveCoupon(code, Number(subtotal));
    if (error) {
      return res.status(400).json({ error });
    }
    return res.json({
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
      discountAmount
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
