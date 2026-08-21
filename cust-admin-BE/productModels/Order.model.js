const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');
const User = require('./User.model');

class Order extends Model {}
Order.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'paid',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
      ),
      allowNull: false,
      defaultValue: 'pending'
    },
    confirmation_email_sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    order_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true
    },
    deleted_by_admin_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    coupon_code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    }
  },
  {
    sequelize: db,
    modelName: 'order',
    tableName: 'orders',
    underscored: true,
    timestamps: true,
    paranoid: true,
    deletedAt: 'deleted_at'
  }
);

Order.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Order, { foreignKey: 'user_id' });

module.exports = Order;
