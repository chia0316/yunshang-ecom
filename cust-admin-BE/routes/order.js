const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { Op } = require('sequelize');

const Order = require('../productModels/Order.model');
const OrderDetail = require('../productModels/OrderDetail.model');
const OrderDelivery = require('../productModels/OrderDelivery.model');
const Payment = require('../productModels/Payment.model');
const Product = require('../productModels/Product.model');
const User = require('../productModels/User.model');
const mailer = require('../utils/mailer');
const validate = require('../utils/validator');
const { authenticate } = require('../utils/authenticator');
const { getCompanySettings } = require('../utils/companySettings');

router.get('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const { status, search, from, to } = req.query;
    const where = {};
    if (status) where.status = status;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }
    if (search && !isNaN(Number(search))) {
      where.id = Number(search);
    }

    const userWhere = search && isNaN(Number(search))
      ? {
          [Op.or]: [
            { firstName: { [Op.iLike]: `%${search}%` } },
            { lastName: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } }
          ]
        }
      : undefined;

    const rows = await Order.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ['firstName', 'lastName', 'email'],
          where: userWhere,
          required: Boolean(userWhere)
        }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/user/:uid', authenticate, async (req, res) => {
  const { uid } = req.params;
  if (!req.isAdmin && req.userId != uid) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const rows = await Order.findAll({
      where: { user_id: uid },
      order: [['created_at', 'DESC']],
      include: [
        {
          model: OrderDetail,
          required: false,
          include: [{ model: Product, attributes: ['sku', 'name', 'price', 'image_filenames'] }]
        }
      ]
    });

    const orderIds = rows.map((row) => row.id);
    const [deliveries, payments] = await Promise.all([
      OrderDelivery.findAll({ where: { order_id: { [Op.in]: orderIds } } }),
      Payment.findAll({
        where: { order_id: { [Op.in]: orderIds } },
        order: [['created_at', 'DESC']]
      })
    ]);
    const deliveryByOrder = Object.fromEntries(deliveries.map((d) => [d.order_id, d]));
    const paymentsByOrder = {};
    payments.forEach((p) => {
      paymentsByOrder[p.order_id] = paymentsByOrder[p.order_id] || [];
      paymentsByOrder[p.order_id].push(p);
    });

    const withDetails = rows.map((row) => ({
      ...row.toJSON(),
      delivery: deliveryByOrder[row.id] || null,
      payments: paymentsByOrder[row.id] || []
    }));

    return res.json(withDetails);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/orderdelivery/:oid', authenticate, async (req, res) => {
  const { oid } = req.params;
  try {
    const row = await OrderDelivery.findOne({ where: { order_id: oid } });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Combined data for the Sales Invoice + Delivery Order report — one order's
// full picture (customer, items, delivery, payment) in a single response so
// the admin-FE print view can render everything as one document.
router.get('/:oid/document', authenticate, async (req, res) => {
  try {
    const { oid } = req.params;
    const order = await Order.findByPk(oid, {
      include: [
        { model: User, attributes: ['firstName', 'lastName', 'email', 'mobile'] },
        {
          model: OrderDetail,
          include: [{ model: Product, attributes: ['sku', 'name', 'price'] }]
        }
      ]
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!req.isAdmin && order.user_id !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized request' });
    }
    const delivery = await OrderDelivery.findOne({ where: { order_id: oid } });
    const payments = await Payment.findAll({
      where: { order_id: oid },
      order: [['created_at', 'DESC']]
    });

    return res.json({
      order,
      delivery,
      payments,
      company: getCompanySettings()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  const isValid = await validate.run(req, res, [
    body('total_price').exists().notEmpty().withMessage('total_price cannot be empty'),
    body('firstName').exists().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').exists().notEmpty().withMessage('Last name cannot be empty'),
    body('deliveryAddress').exists().notEmpty().isString(),
    body('contact').exists().notEmpty().withMessage('Contact number cannot be empty'),
    body('remarks')
      .isLength({ max: 255, min: 0 })
      .optional({ nullable: true })
      .withMessage('Remarks cannot exceed 255 characters'),
    body('orderDetails_list').exists().withMessage('Order details cannot be empty')
  ]);
  if (!isValid) {
    return;
  }
  const {
    total_price,
    firstName,
    lastName,
    deliveryAddress,
    deliveryPostal,
    deliveryDate,
    deliverySlot,
    remarks,
    contact,
    orderDetails_list
  } = req.body;

  try {
    const newOrder = await Order.create({
      user_id: req.userId,
      total_price,
      status: 'pending'
    });

    await OrderDelivery.create({
      order_id: newOrder.id,
      first_name: firstName,
      last_name: lastName,
      delivery_address: deliveryAddress,
      delivery_postal: deliveryPostal,
      delivery_date: deliveryDate || null,
      delivery_slot: deliverySlot || null,
      contact,
      remarks
    });

    await OrderDetail.bulkCreate(
      orderDetails_list.map((item) => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        remarks: item.remarks || null
      }))
    );

    const userData = await User.findByPk(req.userId);
    mailer.sendOrderConfirmationMail(userData, newOrder, orderDetails_list);

    return res.status(201).json({ order: newOrder });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/:oid', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const { status } = req.body;
  try {
    const { oid } = req.params;
    const updated = await Order.update({ status }, { where: { id: oid } });
    if (updated[0] === 0) {
      return res.status(404).json({ message: 'Order not found', success: false });
    }

    const order = await Order.findByPk(oid);
    const user = await User.findByPk(order.user_id);
    mailer.sendOrderStatusUpdateMail(user, order);

    return res.json({ message: 'Order updated successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:oid', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const { oid } = req.params;
    const deletedCount = await Order.destroy({ where: { id: oid } });
    if (deletedCount === 0) {
      return res.status(404).json({ message: 'Order not found', success: false });
    }
    return res.json({ message: 'Order deleted successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
