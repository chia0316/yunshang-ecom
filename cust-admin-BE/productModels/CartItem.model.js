const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');
const User = require('./User.model');
const Product = require('./Product.model');

class CartItem extends Model {}
CartItem.init(
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
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    }
  },
  {
    sequelize: db,
    modelName: 'cartitem',
    tableName: 'cart_items',
    underscored: true,
    timestamps: true
  }
);

CartItem.belongsTo(User, { foreignKey: 'user_id' });
CartItem.belongsTo(Product, { foreignKey: 'product_id' });

module.exports = CartItem;
