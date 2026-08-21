const express = require('express');
const router = express.Router();

const ProductFeaturedTag = require('../productModels/ProductFeaturedTag.model');
const { authenticate, attachAdminFlag } = require('../utils/authenticator');

// Public — the mass-upload template generator and the admin product form
// both read this; non-admin callers only ever see active tags.
router.get('/', attachAdminFlag, async (req, res) => {
  try {
    const where = req.isAdmin ? {} : { is_active: true };
    const tags = await ProductFeaturedTag.findAll({
      where,
      order: [['sort_order', 'ASC']]
    });
    return res.json(tags);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { label, sort_order, is_active } = req.body;
  if (!label || !String(label).trim()) {
    return res.status(400).json({ error: 'Label cannot be empty' });
  }
  try {
    const tag = await ProductFeaturedTag.create({
      label: String(label).trim(),
      sort_order: sort_order || 0,
      is_active: is_active === undefined ? true : is_active
    });
    return res.status(201).json(tag);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A featured tag with this label already exists' });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const allowedFields = ['label', 'sort_order', 'is_active'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
  );
  try {
    const updated = await ProductFeaturedTag.update(updates, { where: { id: req.params.id } });
    if (updated[0] === 0) {
      return res.status(404).json({ message: 'Featured tag not found', success: false });
    }
    return res.json({ message: 'Featured tag updated successfully!', success: true });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A featured tag with this label already exists' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Deleting a tag currently in use on products just detaches it (featured_tag_id
// -> null) rather than blocking the delete — see the FK's ON DELETE SET NULL.
router.delete('/:id', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const deletedCount = await ProductFeaturedTag.destroy({ where: { id: req.params.id } });
    if (deletedCount === 0) {
      return res.status(404).json({ message: 'Featured tag not found', success: false });
    }
    return res.json({ message: 'Featured tag deleted successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
