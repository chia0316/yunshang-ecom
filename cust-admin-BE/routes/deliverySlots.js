const express = require('express');
const router = express.Router();

const DeliverySlot = require('../productModels/DeliverySlot.model');
const { authenticate, attachAdminFlag } = require('../utils/authenticator');

router.get('/', attachAdminFlag, async (req, res) => {
  try {
    const where = req.isAdmin ? {} : { is_active: true };
    const slots = await DeliverySlot.findAll({
      where,
      order: [['sort_order', 'ASC']]
    });
    return res.json(slots);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { name, time_range, sort_order, is_active } = req.body;
  try {
    const slot = await DeliverySlot.create({
      name,
      time_range,
      sort_order: sort_order || 0,
      is_active: is_active === undefined ? true : is_active
    });
    return res.status(201).json(slot);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const allowedFields = ['name', 'time_range', 'sort_order', 'is_active'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
  );
  try {
    const updated = await DeliverySlot.update(updates, { where: { id: req.params.id } });
    if (updated[0] === 0) {
      return res.status(404).json({ message: 'Delivery slot not found', success: false });
    }
    return res.json({ message: 'Delivery slot updated successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const deletedCount = await DeliverySlot.destroy({ where: { id: req.params.id } });
    if (deletedCount === 0) {
      return res.status(404).json({ message: 'Delivery slot not found', success: false });
    }
    return res.json({ message: 'Delivery slot deleted successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
