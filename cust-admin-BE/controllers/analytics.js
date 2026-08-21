const { Op, fn, col, QueryTypes } = require('sequelize');
const User = require('../productModels/User.model');
const Order = require('../productModels/Order.model');
const Product = require('../productModels/Product.model');
const Coupon = require('../productModels/Coupon.model');
const Enquiry = require('../productModels/Enquiry.model');
const db = require('../database/connection');

const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
const ENQUIRY_STATUSES = ['new', 'contacted', 'closed'];
const LOW_STOCK_THRESHOLD = 5;

// Dashboard-glance numbers across every module — deliberately separate from
// the dedicated Sales/Fulfilment report pages (those stay the place for a
// real date-range deep-dive); this is just "what needs my attention today."
const getAnalyticsData = async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).send({ error: 'Unauthorized request' });
    }
    const { from, to } = req.query;
    const loginRange =
      from && to
        ? { [Op.and]: [{ lastLoginAt: { [Op.gte]: from } }, { lastLoginAt: { [Op.lte]: to } }] }
        : {};

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      newLogins,
      totalCustomers,
      newCustomers30d,
      totalOrders,
      totalRevenue,
      orderStatusRows,
      activeProducts,
      lowStockProducts,
      activeCoupons,
      couponRedemptions,
      topCoupon,
      enquiryStatusRows,
      recentEnquiries,
      categoryBreakdown
    ] = await Promise.all([
      User.count({ where: loginRange }),
      User.count({ where: { isAdmin: false } }),
      User.count({ where: { isAdmin: false, createdAt: { [Op.gte]: thirtyDaysAgo } } }),
      Order.count(),
      Order.sum('total_price', { where: { status: { [Op.ne]: 'cancelled' } } }),
      Order.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true
      }),
      Product.count({ where: { is_active: true } }),
      Product.findAll({
        where: { is_active: true, stock_qty: { [Op.lte]: LOW_STOCK_THRESHOLD } },
        attributes: ['id', 'sku', 'name', 'stock_qty'],
        order: [['stock_qty', 'ASC']],
        limit: 5
      }),
      Coupon.count({
        where: {
          is_active: true,
          [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
        }
      }),
      Coupon.sum('used_count'),
      Coupon.findOne({
        where: { used_count: { [Op.gt]: 0 } },
        attributes: ['code', 'used_count'],
        order: [['used_count', 'DESC']]
      }),
      Enquiry.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true
      }),
      Enquiry.count({ where: { createdAt: { [Op.gte]: sevenDaysAgo } } }),
      db.query(
        `SELECT
           c.id AS "categoryId",
           c.name AS "categoryName",
           COUNT(DISTINCT p.id) AS "productCount",
           COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN od.quantity * od.price END), 0) AS "revenue30d"
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
         LEFT JOIN order_details od ON od.product_id = p.id
         LEFT JOIN orders o ON o.id = od.order_id
           AND o.deleted_at IS NULL
           AND o.created_at >= :thirtyDaysAgo
         GROUP BY c.id, c.name
         ORDER BY "revenue30d" DESC`,
        { replacements: { thirtyDaysAgo }, type: QueryTypes.SELECT }
      )
    ]);

    const statusCounts = (rows) =>
      Object.fromEntries(rows.map((r) => [r.status, parseInt(r.count, 10)]));
    const orderStatusCounts = statusCounts(orderStatusRows);
    const enquiryStatusCounts = statusCounts(enquiryStatusRows);

    return res.status(200).send({
      msg: 'Success!',
      newLogins,
      totalCustomers,
      newCustomers30d,
      totalOrders,
      totalRevenue: totalRevenue || 0,
      orderStatusBreakdown: Object.fromEntries(
        ORDER_STATUSES.map((s) => [s, orderStatusCounts[s] || 0])
      ),
      activeProducts,
      lowStockProducts,
      activeCoupons,
      couponRedemptions: couponRedemptions || 0,
      topCoupon: topCoupon ? { code: topCoupon.code, usedCount: topCoupon.used_count } : null,
      enquiryStatusBreakdown: Object.fromEntries(
        ENQUIRY_STATUSES.map((s) => [s, enquiryStatusCounts[s] || 0])
      ),
      recentEnquiries,
      categoryBreakdown: categoryBreakdown.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        productCount: parseInt(row.productCount, 10),
        revenue30d: parseFloat(row.revenue30d)
      }))
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = { getAnalyticsData };
