const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');
const Category = require('./Category.model');

class Product extends Model {}
Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    brand: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    short_description: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    sale_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    stock_qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    weight_kg: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true
    },
    dimensions: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    video_filename: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    lead_time_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: []
    },
    image_filenames: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: []
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    deleted_on: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize: db,
    modelName: 'product',
    tableName: 'products',
    underscored: true,
    timestamps: true
  }
);

Category.hasMany(Product, { foreignKey: 'category_id' });
Product.belongsTo(Category, { foreignKey: 'category_id' });

module.exports = Product;
