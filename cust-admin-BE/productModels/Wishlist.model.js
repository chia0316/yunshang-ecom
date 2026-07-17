const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');
const User = require('./User.model');
const Product = require('./Product.model');

class Wishlist extends Model {}
Wishlist.init(
  {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    }
  },
  {
    sequelize: db,
    modelName: 'wishlist',
    tableName: 'wishlists',
    underscored: true,
    timestamps: true
  }
);

Wishlist.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Wishlist, { foreignKey: 'user_id' });
Wishlist.belongsTo(Product, { foreignKey: 'product_id' });
Product.hasMany(Wishlist, { foreignKey: 'product_id' });

module.exports = Wishlist;
