const express = require('express');
const router = express.Router();
const { Op, fn, col, literal, QueryTypes } = require('sequelize');

const Order = require('../productModels/Order.model');
const db = require('../database/connection');
const { authenticate } = require('../utils/authenticator');

const VALID_GROUPINGS = ['day', 'week', 'month'];

// Sales summary + time series + top products for a date range. Cancelled
// orders are excluded from revenue the same way the dashboard analytics does.
router.get('/sales', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const groupBy = VALID_GROUPINGS.includes(req.query.groupBy) ? req.query.groupBy : 'day';
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from
      ? new Date(req.query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const where = {
      status: { [Op.ne]: 'cancelled' },
      created_at: { [Op.gte]: from, [Op.lte]: to }
    };

    const summaryRow = await Order.findOne({
      attributes: [
        [fn('COUNT', col('id')), 'orderCount'],
        [fn('COALESCE', fn('SUM', col('total_price')), 0), 'totalRevenue'],
        [fn('COALESCE', fn('AVG', col('total_price')), 0), 'averageOrderValue']
      ],
      where,
      raw: true
    });

    const series = await Order.findAll({
      attributes: [
        [fn('date_trunc', groupBy, col('created_at')), 'period'],
        [fn('COUNT', col('id')), 'orderCount'],
        [fn('COALESCE', fn('SUM', col('total_price')), 0), 'revenue']
      ],
      where,
      group: [literal('1')],
      order: [[literal('1'), 'ASC']],
      raw: true
    });

    const topProducts = await db.query(
      `SELECT
         od.product_id AS "productId",
         p.name AS "name",
         p.sku AS "sku",
         SUM(od.quantity) AS "unitsSold",
         SUM(od.quantity * od.price) AS "revenue"
       FROM order_details od
       JOIN orders o ON o.id = od.order_id
       JOIN products p ON p.id = od.product_id
       WHERE o.status != 'cancelled'
         AND o.deleted_at IS NULL
         AND o.created_at BETWEEN :from AND :to
       GROUP BY od.product_id, p.name, p.sku
       ORDER BY "unitsSold" DESC
       LIMIT 5`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    return res.json({
      range: { from, to, groupBy },
      summary: {
        orderCount: parseInt(summaryRow.orderCount, 10),
        totalRevenue: parseFloat(summaryRow.totalRevenue),
        averageOrderValue: parseFloat(summaryRow.averageOrderValue)
      },
      series: series.map((row) => ({
        period: row.period,
        orderCount: parseInt(row.orderCount, 10),
        revenue: parseFloat(row.revenue)
      })),
      topProducts: topProducts.map((row) => ({
        productId: row.productId,
        name: row.name,
        sku: row.sku,
        unitsSold: parseInt(row.unitsSold, 10),
        revenue: parseFloat(row.revenue)
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Per-category ordered vs. delivered quantity — highlights the backlog
// still owed to customers (balance = ordered - delivered). All-time by
// default since this is meant to surface outstanding fulfilment, not a
// recent-activity window like /sales.
router.get('/category-fulfillment', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }
  try {
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date('2000-01-01');

    const rows = await db.query(
      `SELECT
         c.id AS "categoryId",
         c.name AS "categoryName",
         COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN od.quantity END), 0) AS "quantityOrdered",
         COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN od.quantity END), 0) AS "quantityDelivered"
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       LEFT JOIN order_details od ON od.product_id = p.id
       LEFT JOIN orders o ON o.id = od.order_id
         AND o.deleted_at IS NULL
         AND o.created_at BETWEEN :from AND :to
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    return res.json({
      range: { from, to },
      categories: rows.map((row) => {
        const ordered = parseInt(row.quantityOrdered, 10);
        const delivered = parseInt(row.quantityDelivered, 10);
        return {
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          quantityOrdered: ordered,
          quantityDelivered: delivered,
          balance: ordered - delivered
        };
      })
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
