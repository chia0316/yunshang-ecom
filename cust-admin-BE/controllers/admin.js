const { Op } = require('sequelize');
const { body } = require('express-validator');

const User = require('../productModels/User.model');
const Order = require('../productModels/Order.model');
const DeletedRecord = require('../productModels/DeletedRecord.model');
const validate = require('../utils/validator');

// Merges order_count/total_spent onto each user row — a single grouped
// query rather than N+1 per-user lookups.
const withOrderStats = async (users) => {
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return users;

  const stats = await Order.findAll({
    attributes: [
      'user_id',
      [Order.sequelize.fn('COUNT', Order.sequelize.col('id')), 'orderCount'],
      [
        Order.sequelize.fn(
          'COALESCE',
          Order.sequelize.fn('SUM', Order.sequelize.col('total_price')),
          0
        ),
        'totalSpent'
      ]
    ],
    where: {
      user_id: { [Op.in]: userIds },
      status: { [Op.ne]: 'cancelled' }
    },
    group: ['user_id'],
    raw: true
  });
  const statsByUser = Object.fromEntries(stats.map((s) => [s.user_id, s]));

  return users.map((user) => ({
    ...(user.toJSON ? user.toJSON() : user),
    orderCount: parseInt(statsByUser[user.id]?.orderCount || 0, 10),
    totalSpent: parseFloat(statsByUser[user.id]?.totalSpent || 0)
  }));
};

const listUsers = async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).send({ error: 'Unauthorized request' });
    }
    const status = req.params.status;
    const userList = await User.findAll({
      where: { [Op.and]: [{ status }, { isAdmin: false }] },
      order: [['created_at', 'DESC']],
      attributes: { exclude: ['password'] }
    });
    return res.status(200).send({ userList: await withOrderStats(userList) });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getAdminUsersPaging = async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).send({ error: 'Unauthorized request' });
    }
    const status = req.params.status;
    const page = req.query.page || 1;
    const page_size = req.query.page_size || 10;
    const offset = (page - 1) * page_size;

    const userList = await User.findAndCountAll({
      where: { [Op.and]: [{ status }, { isAdmin: false }] },
      order: [['created_at', 'DESC']],
      attributes: { exclude: ['password'] },
      offset,
      limit: page_size
    });

    return res.status(200).json({
      total_pages: parseInt(Math.ceil(userList.count / page_size)),
      userList: await withOrderStats(userList.rows)
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getCustomerDetail = async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).send({ error: 'Unauthorized request' });
    }
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).send({ error: 'User account not found' });
    }
    const [withStats] = await withOrderStats([user]);
    return res.status(200).send({ data: withStats });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const updateUserData = async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).send({ error: 'Unauthorized request' });
    }
    const isValid = await validate.run(req, res, [
      body('status').optional().isIn([...User.rawAttributes.status.values])
    ]);
    if (!isValid) {
      return;
    }
    const { userId, status, mobile, deliveryAddress, deliveryPostal } = req.body;
    const userExists = await User.findByPk(userId);
    if (!userExists) {
      return res.status(404).send({ error: 'User account not found' });
    }
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (mobile !== undefined) updates.mobile = mobile;
    if (deliveryAddress !== undefined) updates.deliveryAddress = deliveryAddress;
    if (deliveryPostal !== undefined) updates.deliveryPostal = deliveryPostal;

    await User.update(updates, { where: { id: userId } });

    return res.status(200).send({ message: 'User account updated successfully' });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).send({ error: 'Unauthorized request' });
    }
    const userId = req.params.id;
    const userExists = await User.findByPk(userId, { raw: true });
    if (!userExists) {
      return res.status(404).send({ error: 'User account not found' });
    }
    await DeletedRecord.create({
      original_user_id: userExists.id,
      username: userExists.username,
      email: userExists.email,
      firstName: userExists.firstName,
      lastName: userExists.lastName,
      mobile: userExists.mobile
    });
    await User.destroy({ where: { id: userId } });
    return res.status(200).send({ message: 'User account deleted successfully' });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  listUsers,
  getAdminUsersPaging,
  getCustomerDetail,
  updateUserData,
  deleteUser
};
