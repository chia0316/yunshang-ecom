const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { Op } = require('sequelize');

const db = require('../database/connection');
const Enquiry = require('../productModels/Enquiry.model');
const QrCode = require('../productModels/QrCode.model');
const Setting = require('../productModels/Setting.model');
const mailer = require('../utils/mailer');
const validate = require('../utils/validator');
const { authenticate } = require('../utils/authenticator');
const { getCompanySettings } = require('../utils/companySettings');

const APPOINTMENT_TYPES = ['appointment', 'appointment_no_sales'];

// Mirrors the exact label generation in cust-FE's VisitUsPage.tsx and
// admin-FE's enquiryConstants.ts TIME_SLOTS — used here to go from a
// preferred_time label back to its start hour (0-23), for the business-
// hours check below. A lookup table beats parsing the label text.
const formatHour = (hour) => {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
};
const HOUR_BY_LABEL = new Map(
  Array.from({ length: 24 }, (_, hour) => [
    `${formatHour(hour)} - ${formatHour((hour + 1) % 24)}`,
    hour
  ])
);
const SALES_PERSON_HOURS = { start: 9, end: 17 }; // 9am–6pm, inclusive of the 5-6pm slot

// Admin-configurable via Settings > General — defaults to 1 (today's
// behavior) if never set or set to something invalid.
const getSlotsPerHour = async () => {
  const setting = await Setting.findByPk('appointment_slots_per_hour');
  const parsed = parseInt(setting?.value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

// Shared by the manual admin "Confirm & Send QR" button (POST /:id/confirm)
// and auto-confirm on booking (POST /) — finds whichever QR code is
// currently active and emails it, or returns null if none is available
// (caller decides what to do: 400 for the manual button, fall back to the
// generic "we received your request" email for a fresh booking).
const confirmAppointmentAndSendQr = async (enquiry, company) => {
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
  if (!qrCode) return null;

  await enquiry.update({ status: 'confirmed', confirmed_at: new Date(), qr_code_id: qrCode.id });
  mailer.sendAppointmentQrCodeMail(enquiry, qrCode, company);
  return qrCode;
};

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
      // Re-validated server-side, not just hidden in the UI — a sales-
      // person visit only makes sense during staffed hours.
      if (APPOINTMENT_TYPES.includes(req.body.type) && req.body.requires_sales_person && value) {
        const hour = HOUR_BY_LABEL.get(value);
        if (hour === undefined || hour < SALES_PERSON_HOURS.start || hour > SALES_PERSON_HOURS.end) {
          throw new Error('Appointments with a sales person can only be booked between 9am and 6pm');
        }
      }
      return true;
    })
  ]);
  if (!isValid) {
    return;
  }
  const { type, name, email, mobile, preferred_date, preferred_time, message, requires_sales_person } = req.body;
  const isAppointment = APPOINTMENT_TYPES.includes(type);
  try {
    let enquiry;
    if (isAppointment) {
      const slotsPerHour = await getSlotsPerHour();
      enquiry = await db.transaction(async (t) => {
        // Serializes concurrent bookings for the *same* slot only — a
        // hashtext() collision between two different slots just means they
        // briefly wait on each other, never an incorrect accept/reject.
        // This is what actually closes the race a plain count-then-insert
        // would have now that capacity can be more than 1 (a DB unique
        // index can't express "at most N", only "at most 1").
        await db.query('SELECT pg_advisory_xact_lock(hashtext(:slotKey))', {
          replacements: { slotKey: `${preferred_date}|${preferred_time}` },
          transaction: t
        });
        const existingCount = await Enquiry.count({
          where: { type: { [Op.in]: APPOINTMENT_TYPES }, preferred_date, preferred_time },
          transaction: t
        });
        if (existingCount >= slotsPerHour) {
          const full = new Error('Slot full');
          full.code = 'SLOT_FULL';
          throw full;
        }
        return Enquiry.create(
          {
            type,
            name,
            email,
            mobile,
            preferred_date,
            preferred_time,
            message: message || null,
            requires_sales_person: Boolean(requires_sales_person)
          },
          { transaction: t }
        );
      });
    } else {
      enquiry = await Enquiry.create({
        type,
        name,
        email,
        mobile,
        preferred_date: preferred_date || null,
        preferred_time: preferred_time || null,
        message: message || null,
        requires_sales_person: Boolean(requires_sales_person)
      });
    }

    const company = getCompanySettings();
    mailer.sendEnquiryNotificationMail(enquiry, company);

    // Appointments auto-confirm and get the QR code emailed immediately —
    // no admin action needed unless there's genuinely no active QR code
    // yet, in which case this falls back to the old "we received your
    // request" email and the enquiry stays 'new' for admin to confirm
    // manually once a code exists (same path POST /:id/confirm handles).
    let autoConfirmed = false;
    if (isAppointment) {
      const qrCode = await confirmAppointmentAndSendQr(enquiry, company);
      autoConfirmed = Boolean(qrCode);
    }
    if (!autoConfirmed) {
      mailer.sendEnquiryConfirmationMail(enquiry, company);
    }

    return res.status(201).json({ message: 'Request submitted successfully!', success: true });
  } catch (err) {
    if (err.code === 'SLOT_FULL') {
      return res
        .status(409)
        .json({ error: 'That time slot was just booked by someone else — please pick another.' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Public — powers the Visit Us page's time-slot picker. For every date in
// [from, to], how many bookings each preferred_time slot already has (any
// status — there's no "cancelled" status distinct from "closed" and no
// delete/cancel endpoint today, so status can't reliably signal a slot
// freed up; counting regardless is the safe default). The frontend
// subtracts this from the configured capacity to show "N left".
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
    const countsByDate = {};
    rows.forEach((row) => {
      const date = row.preferred_date;
      if (!countsByDate[date]) countsByDate[date] = {};
      countsByDate[date][row.preferred_time] = (countsByDate[date][row.preferred_time] || 0) + 1;
    });
    return res.json(countsByDate);
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
// Bookings auto-confirm on submission now (see POST / above), so this is
// mainly for: resending, or completing one that couldn't auto-confirm
// because no QR code was active yet at booking time.
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

    const qrCode = await confirmAppointmentAndSendQr(enquiry, getCompanySettings());
    if (!qrCode) {
      return res.status(400).json({
        error: 'No active QR code available — upload one in Settings > QR Codes before confirming this appointment.'
      });
    }

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
