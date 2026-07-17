const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');
const Order = require('./Order.model');

class OrderDelivery extends Model {}
OrderDelivery.init(
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
    first_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    delivery_address: {
      type: DataTypes.STRING,
      allowNull: false
    },
    delivery_postal: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    delivery_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    delivery_slot: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    contact: {
      type: DataTypes.STRING,
      allowNull: false
    },
    remarks: {
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    sequelize: db,
    modelName: 'orderdelivery',
    tableName: 'order_deliveries',
    underscored: true,
    timestamps: true
  }
);

OrderDelivery.belongsTo(Order, { foreignKey: 'order_id' });
Order.hasOne(OrderDelivery, { foreignKey: 'order_id' });

module.exports = OrderDelivery;
