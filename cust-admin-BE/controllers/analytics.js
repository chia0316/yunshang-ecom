const { Op } = require('sequelize');
const User = require('../productModels/User.model');
const Order = require('../productModels/Order.model');

const getAnalyticsData = async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).send({ error: 'Unauthorized request' });
    }
    const { from, to } = req.query;
    const range =
      from && to
        ? {
            [Op.and]: [
              { last_login_at: { [Op.gte]: from } },
              { last_login_at: { [Op.lte]: to } }
            ]
          }
        : {};

    const newLogins = await User.count({ where: range });
    const totalCustomers = await User.count({ where: { isAdmin: false } });
    const totalOrders = await Order.count();
    const totalRevenue = await Order.sum('total_price', {
      where: { status: { [Op.ne]: 'cancelled' } }
    });

    return res.status(200).send({
      msg: 'Success!',
      newLogins,
      totalCustomers,
      totalOrders,
      totalRevenue: totalRevenue || 0
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = { getAnalyticsData };
