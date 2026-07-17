const express = require('express');
const router = express.Router();
const Category = require('../productModels/Category.model');
const { authenticate } = require('../utils/authenticator');

router.get('/', async (req, res) => {
  try {
    const rows = await Category.findAll({ order: [['name', 'ASC']] });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { name, sub, description } = req.body;
  try {
    const category = await Category.create({ name, sub, description });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:cid', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { cid } = req.params;
  const { name, sub, description } = req.body;
  try {
    const updated = await Category.update(
      { name, sub, description },
      { where: { id: cid } }
    );
    if (updated[0] === 0) {
      return res.status(404).json({ message: 'Category not found', success: false });
    }
    return res.json({ message: 'Category updated successfully!', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:cid', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const { cid } = req.params;
    const deletedCount = await Category.destroy({ where: { id: cid } });
    if (deletedCount === 0) {
      return res.status(404).json({ message: 'Category not found', success: false });
    }
    return res.json({ message: 'Category deleted successfully!', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
