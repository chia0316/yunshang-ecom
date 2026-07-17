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
    }
  },
  {
    sequelize: db,
    modelName: 'order',
    tableName: 'orders',
    underscored: true,
    timestamps: true
  }
);

Order.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Order, { foreignKey: 'user_id' });

module.exports = Order;
