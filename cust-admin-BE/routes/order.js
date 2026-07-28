const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');

const Order = require('../productModels/Order.model');
const OrderDetail = require('../productModels/OrderDetail.model');
const OrderDelivery = require('../productModels/OrderDelivery.model');
const Payment = require('../productModels/Payment.model');
const Product = require('../productModels/Product.model');
const User = require('../productModels/User.model');
const Coupon = require('../productModels/Coupon.model');
const mailer = require('../utils/mailer');
const validate = require('../utils/validator');
const { authenticate } = require('../utils/authenticator');
const { getCompanySettings } = require('../utils/companySettings');
const { resolveCoupon } = require('../utils/coupons');

// Shared by the order list and the Excel export — same status/search/date
// filters should apply to both.
const buildOrderFilters = ({ status, search, from, to }) => {
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

  return { where, userWhere };
};

router.get('/', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const { where, userWhere } = buildOrderFilters(req.query);

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

// Exports orders (one row per order) and order line items (one row per
// item) to a single .xlsx workbook, using the same status/search/date-range
// filters as the Orders list page.
router.get('/export', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const { where, userWhere } = buildOrderFilters(req.query);

    const orders = await Order.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ['firstName', 'lastName', 'email'],
          where: userWhere,
          required: Boolean(userWhere)
        },
        {
          model: OrderDetail,
          required: false,
          include: [{ model: Product, attributes: ['sku', 'name'] }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const orderIds = orders.map((o) => o.id);
    const deliveries = await OrderDelivery.findAll({ where: { order_id: { [Op.in]: orderIds } } });
    const deliveryByOrder = Object.fromEntries(deliveries.map((d) => [d.order_id, d]));

    const workbook = new ExcelJS.Workbook();

    const ordersSheet = workbook.addWorksheet('Orders');
    ordersSheet.columns = [
      { header: 'Order ID', key: 'id', width: 10 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Coupon Code', key: 'couponCode', width: 16 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Delivery Address', key: 'address', width: 35 },
      { header: 'Delivery Date', key: 'deliveryDate', width: 14 },
      { header: 'Created At', key: 'createdAt', width: 20 }
    ];
    orders.forEach((order) => {
      const delivery = deliveryByOrder[order.id];
      ordersSheet.addRow({
        id: order.id,
        customer: order.user ? `${order.user.firstName} ${order.user.lastName}` : '',
        email: order.user?.email || '',
        status: order.status,
        couponCode: order.coupon_code || '',
        discount: order.discount_amount ? Number(order.discount_amount) : '',
        total: Number(order.total_price),
        address: delivery?.delivery_address || '',
        deliveryDate: delivery?.delivery_date || '',
        createdAt: order.created_at.toISOString()
      });
    });

    const itemsSheet = workbook.addWorksheet('Order Items');
    itemsSheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 10 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Product Name', key: 'name', width: 35 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Unit Price', key: 'price', width: 12 },
      { header: 'Line Total', key: 'lineTotal', width: 12 }
    ];
    orders.forEach((order) => {
      (order.orderdetails || []).forEach((item) => {
        itemsSheet.addRow({
          orderId: order.id,
          sku: item.product?.sku || '',
          name: item.product?.name || '',
          quantity: item.quantity,
          price: Number(item.price),
          lineTotal: Number(item.price) * item.quantity
        });
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orders-export-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    await workbook.xlsx.write(res);
    res.end();
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
    orderDetails_list,
    couponCode
  } = req.body;

  try {
    // Discount is always recomputed server-side from the coupon rules — the
    // client only ever sends the pre-discount total_price (subtotal +
    // shipping), never the discount amount itself, so it can't be faked.
    let discountAmount = 0;
    let appliedCouponCode = null;
    if (couponCode) {
      const subtotal = orderDetails_list.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );
      const result = await resolveCoupon(couponCode, subtotal);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      discountAmount = result.discountAmount;
      appliedCouponCode = result.coupon.code;
    }

    const newOrder = await Order.create({
      user_id: req.userId,
      total_price: Math.max(Number(total_price) - discountAmount, 0),
      coupon_code: appliedCouponCode,
      discount_amount: appliedCouponCode ? discountAmount : null,
      status: 'pending'
    });

    if (appliedCouponCode) {
      await Coupon.increment('used_count', { where: { code: appliedCouponCode } });
    }

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

// Lets admin record the delivery date/slot agreed with the customer over
// WhatsApp/email/call once checkout no longer collects a preferred date
// directly — shows up on the invoice/delivery order document.
router.patch('/:oid/delivery', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  const allowedFields = ['delivery_date', 'delivery_slot', 'remarks'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
  );
  try {
    const { oid } = req.params;
    const updated = await OrderDelivery.update(updates, { where: { order_id: oid } });
    if (updated[0] === 0) {
      return res.status(404).json({ message: 'Order delivery info not found', success: false });
    }
    return res.json({ message: 'Delivery info updated successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Soft-delete only — the row and its deleted_by_admin_id are kept (see
// paranoid/deletedAt on the Order model) so a deleted order can always be
// traced back to who removed it and when, instead of vanishing without trace.
router.delete('/:oid', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const { oid } = req.params;
    const order = await Order.findByPk(oid);
    if (!order) {
      return res.status(404).json({ message: 'Order not found', success: false });
    }
    await order.update({ deleted_by_admin_id: req.userId });
    await order.destroy();
    return res.json({ message: 'Order deleted successfully!', success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
