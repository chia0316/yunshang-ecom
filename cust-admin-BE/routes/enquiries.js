const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const Enquiry = require('../productModels/Enquiry.model');
const mailer = require('../utils/mailer');
const validate = require('../utils/validator');
const { authenticate } = require('../utils/authenticator');

// Public — the landing-page "Visit Us / Enquire" form submits here directly,
// no account required.
router.post('/', async (req, res) => {
  const isValid = await validate.run(req, res, [
    body('type')
      .isIn(['appointment', 'appointment_no_sales', 'enquiry', 'other'])
      .withMessage('Invalid enquiry type'),
    body('name').exists().notEmpty().withMessage('Name cannot be empty'),
    body('email').exists().isEmail().withMessage('A valid email is required')
  ]);
  if (!isValid) {
    return;
  }
  const { type, name, email, mobile, preferred_date, preferred_time, message } = req.body;
  try {
    const enquiry = await Enquiry.create({
      type,
      name,
      email,
      mobile: mobile || null,
      preferred_date: preferred_date || null,
      preferred_time: preferred_time || null,
      message: message || null
    });
    mailer.sendEnquiryNotificationMail(enquiry);
    mailer.sendEnquiryConfirmationMail(enquiry);
    return res.status(201).json({ message: 'Request submitted successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const where = req.query.status ? { status: req.query.status } : {};
    const enquiries = await Enquiry.findAll({ where, order: [['created_at', 'DESC']] });
    return res.json(enquiries);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { status } = req.body;
  if (!['new', 'contacted', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const updated = await Enquiry.update({ status }, { where: { id: req.params.id } });
    if (updated[0] === 0) {
      return res.status(404).json({ message: 'Enquiry not found', success: false });
    }
    return res.json({ message: 'Enquiry updated successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
