const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');
const Order = require('./Order.model');

class Payment extends Model {}
Payment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'SGD'
    },
    method: {
      type: DataTypes.ENUM('PayNow', 'NETS', 'Card', 'Cash'),
      allowNull: false
    },
    gateway_reference: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending'
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    raw_response: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  },
  {
    sequelize: db,
    modelName: 'payment',
    tableName: 'payments',
    underscored: true,
    timestamps: true
  }
);

Payment.belongsTo(Order, { foreignKey: 'order_id' });
Order.hasMany(Payment, { foreignKey: 'order_id' });

module.exports = Payment;
