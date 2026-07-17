const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');
const Order = require('./Order.model');
const Product = require('./Product.model');

class OrderDetail extends Model {}
OrderDetail.init(
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
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    remarks: {
      type: DataTypes.STRING(200),
      allowNull: true
    }
  },
  {
    sequelize: db,
    modelName: 'orderdetail',
    tableName: 'order_details',
    underscored: true,
    timestamps: true
  }
);

OrderDetail.belongsTo(Product, { foreignKey: 'product_id' });
Order.hasMany(OrderDetail, { foreignKey: 'order_id' });
OrderDetail.belongsTo(Order, { foreignKey: 'order_id' });

module.exports = OrderDetail;
