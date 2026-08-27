const express = require('express');
const router = express.Router();

const Order = require('../productModels/Order.model');
const Enquiry = require('../productModels/Enquiry.model');
const { authenticate } = require('../utils/authenticator');

// Powers the admin header's notification bell — a live count of items still
// needing attention (orders awaiting payment confirmation, enquiries no one
// has triaged yet), not a one-time "unseen" ping with read/unread state to
// track. The badge just reflects current reality and clears itself as
// admin acts (marks an order paid, moves an enquiry off 'new') — no new
// tables or polling infrastructure needed.
router.get('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const [pendingOrders, newEnquiries] = await Promise.all([
      Order.count({ where: { status: 'pending' } }),
      Enquiry.count({ where: { status: 'new' } })
    ]);
    return res.json({ pendingOrders, newEnquiries });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
