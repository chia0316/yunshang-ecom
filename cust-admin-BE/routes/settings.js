const express = require('express');
const router = express.Router();

const Setting = require('../productModels/Setting.model');
const { authenticate } = require('../utils/authenticator');

// Public — the storefront reads these directly (e.g. free delivery
// threshold), so no auth is required to view them.
router.get('/', async (req, res) => {
  try {
    const rows = await Setting.findAll();
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:key', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: 'value is required' });
  }
  try {
    const [setting] = await Setting.upsert({
      key: req.params.key,
      value: String(value)
    });
    return res.json(setting);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
