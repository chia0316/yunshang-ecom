const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');

class Coupon extends Model {}
Coupon.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    discount_type: {
      type: DataTypes.ENUM('percent', 'fixed'),
      allowNull: false
    },
    discount_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    min_order_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    max_uses: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    used_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize: db,
    modelName: 'coupon',
    tableName: 'coupons',
    underscored: true,
    timestamps: true
  }
);

module.exports = Coupon;
