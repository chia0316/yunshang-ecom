const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { Op } = require('sequelize');

const Enquiry = require('../productModels/Enquiry.model');
const QrCode = require('../productModels/QrCode.model');
const mailer = require('../utils/mailer');
const validate = require('../utils/validator');
const { authenticate } = require('../utils/authenticator');
const { getCompanySettings } = require('../utils/companySettings');

const APPOINTMENT_TYPES = ['appointment', 'appointment_no_sales'];

// Public — the landing-page "Visit Us / Enquire" form submits here directly,
// no account required.
router.post('/', async (req, res) => {
  const isValid = await validate.run(req, res, [
    // 'appointment_no_sales' was added to the ENUM in a later migration but
    // this whitelist was never updated to match — the public storefront form
    // could never actually submit one until now.
    body('type').isIn([...APPOINTMENT_TYPES, 'enquiry', 'other']).withMessage('Invalid enquiry type'),
    body('name').exists().notEmpty().withMessage('Name cannot be empty'),
    body('email').exists().isEmail().withMessage('A valid email is required'),
    body('mobile').exists().notEmpty().withMessage('Mobile number is required'),
    // Both fields are optional for a general enquiry, but an appointment
    // booking is meaningless without them — this is also what the slot
    // system below depends on being present.
    body('preferred_date').custom((value, { req }) => {
      if (APPOINTMENT_TYPES.includes(req.body.type) && !value) {
        throw new Error('Preferred date is required for appointment bookings');
      }
      return true;
    }),
    body('preferred_time').custom((value, { req }) => {
      if (APPOINTMENT_TYPES.includes(req.body.type) && !value) {
        throw new Error('Preferred time is required for appointment bookings');
      }
      return true;
    })
  ]);
  if (!isValid) {
    return;
  }
  const { type, name, email, mobile, preferred_date, preferred_time, message, requires_sales_person } = req.body;
  try {
    const enquiry = await Enquiry.create({
      type,
      name,
      email,
      mobile,
      preferred_date: preferred_date || null,
      preferred_time: preferred_time || null,
      message: message || null,
      requires_sales_person: Boolean(requires_sales_person)
    });
    const company = getCompanySettings();
    mailer.sendEnquiryNotificationMail(enquiry, company);
    mailer.sendEnquiryConfirmationMail(enquiry, company);
    return res.status(201).json({ message: 'Request submitted successfully!', success: true });
  } catch (err) {
    // The partial unique index on (preferred_date, preferred_time) for
    // appointment types (see migrations) is what actually prevents two
    // customers from booking the same hour — this just turns that DB-level
    // rejection into a message that makes sense to the customer.
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res
        .status(409)
        .json({ error: 'That time slot was just booked by someone else — please pick another.' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Public — powers the Visit Us page's calendar. For every date in
// [from, to], the list of preferred_time slots an appointment already
// occupies (any status — there's no "cancelled" status distinct from
// "closed" and no delete/cancel endpoint today, so status can't reliably
// signal a slot freed up; blocking regardless is the safe default).
router.get('/appointment-availability', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to query params are required' });
  }
  try {
    const rows = await Enquiry.findAll({
      where: {
        type: { [Op.in]: APPOINTMENT_TYPES },
        preferred_date: { [Op.between]: [from, to] },
        preferred_time: { [Op.ne]: null }
      },
      attributes: ['preferred_date', 'preferred_time']
    });
    const takenByDate = {};
    rows.forEach((row) => {
      const date = row.preferred_date;
      if (!takenByDate[date]) takenByDate[date] = [];
      takenByDate[date].push(row.preferred_time);
    });
    return res.json(takenByDate);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    // Comma-separated so the admin appointment calendar can ask for both
    // 'appointment' and 'appointment_no_sales' in one call.
    if (req.query.type) where.type = { [Op.in]: req.query.type.split(',') };
    // The storefront form never actually lets a customer submit
    // type='appointment_no_sales' (VisitUsPage.tsx only offers
    // 'appointment'/'enquiry'/'other') — whether a sales person is wanted
    // is captured by this boolean on the single 'appointment' type instead,
    // so the admin "Appointment (no sales)" filter needs to query on this,
    // not on the type value.
    if (req.query.requires_sales_person !== undefined) {
      where.requires_sales_person = req.query.requires_sales_person === 'true';
    }
    // Filters on when the *appointment* is/was for — used by the admin
    // calendar view. Distinct from from/to below (received date), same
    // split as routes/order.js's search vs from/to.
    if (req.query.preferred_from || req.query.preferred_to) {
      where.preferred_date = {};
      if (req.query.preferred_from) where.preferred_date[Op.gte] = req.query.preferred_from;
      if (req.query.preferred_to) where.preferred_date[Op.lte] = req.query.preferred_to;
    }
    // Filters on when the enquiry was *received* — the List view's From/To,
    // matching routes/order.js's convention.
    if (req.query.from || req.query.to) {
      where.created_at = {};
      if (req.query.from) where.created_at[Op.gte] = new Date(req.query.from);
      if (req.query.to) where.created_at[Op.lte] = new Date(req.query.to);
    }
    if (req.query.search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${req.query.search}%` } },
        { email: { [Op.iLike]: `%${req.query.search}%` } },
        { mobile: { [Op.iLike]: `%${req.query.search}%` } }
      ];
    }
    const page = parseInt(req.query.page) || 1;
    const page_size = parseInt(req.query.page_size) || 20;
    const offset = (page - 1) * page_size;
    const { count, rows } = await Enquiry.findAndCountAll({
      where,
      include: [{ model: QrCode, attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      offset,
      limit: page_size
    });
    return res.json({
      total_pages: Math.ceil(count / page_size),
      total: count,
      data: rows
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { status } = req.body;
  // 'confirmed' is deliberately excluded here — it can only be reached via
  // POST /:id/confirm below, which is what actually finds and sends the QR
  // code. Allowing it through this plain status update would let an
  // appointment end up "confirmed" with no code ever sent.
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

// Confirms an appointment and emails whichever QR code is currently active —
// also doubles as "resend" when called again on an already-confirmed
// appointment (e.g. the customer lost the email, or the active code has
// since rotated to a newer one and they need the current one instead).
router.post('/:id/confirm', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const enquiry = await Enquiry.findByPk(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found', success: false });
    }
    if (!APPOINTMENT_TYPES.includes(enquiry.type)) {
      return res.status(400).json({ error: 'Only appointment bookings can be confirmed with a QR code' });
    }

    const today = new Date().toISOString().slice(0, 10);
    // Soonest-expiring active code wins if validity windows overlap — uses
    // up whichever code is closest to lapsing first, rather than an
    // arbitrary pick.
    const qrCode = await QrCode.findOne({
      where: {
        valid_from: { [Op.lte]: today },
        valid_until: { [Op.gte]: today },
        revoked_at: null
      },
      order: [['valid_until', 'ASC']]
    });
    if (!qrCode) {
      return res.status(400).json({
        error: 'No active QR code available — upload one in Settings > QR Codes before confirming this appointment.'
      });
    }

    await enquiry.update({ status: 'confirmed', confirmed_at: new Date(), qr_code_id: qrCode.id });
    mailer.sendAppointmentQrCodeMail(enquiry, qrCode, getCompanySettings());

    return res.json({
      message: 'Appointment confirmed and QR code sent',
      success: true,
      enquiry: { ...enquiry.toJSON(), qrcode: { id: qrCode.id, name: qrCode.name } }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
