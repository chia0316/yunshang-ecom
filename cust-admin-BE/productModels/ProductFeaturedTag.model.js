const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');

class ProductFeaturedTag extends Model {}
ProductFeaturedTag.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    // Hex color (e.g. "#f59e0b") for the badge shown on this tag's products —
    // admin-chosen, replaces the old hardcoded amber/red badge color.
    color: {
      type: DataTypes.STRING(7),
      allowNull: false,
      defaultValue: '#f59e0b'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize: db,
    modelName: 'productfeaturedtag',
    tableName: 'product_featured_tags',
    underscored: true,
    timestamps: true
  }
);

module.exports = ProductFeaturedTag;
