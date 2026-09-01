const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');
const Category = require('./Category.model');
const ProductFeaturedTag = require('./ProductFeaturedTag.model');

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
    // Replaces the old is_featured boolean — see ProductFeaturedTag.model.js.
    // The is_featured column still physically exists in the DB (unused) but
    // is deliberately left out of this model definition.
    featured_tag_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Rows sharing the same product_handle are variants of one logical
    // product (e.g. Material: Leather vs Fabric on the same sofa). Null
    // means this product has no variants — a standalone SKU.
    product_handle: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    // This row's specific option combo, e.g. { "Material": "Leather",
    // "Color": "Black" }. Null/empty for non-variant products.
    variant_options: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    // Which variant's photo/card represents the whole product_handle group
    // on the storefront listing page — admin-chosen, via
    // PATCH /:id/set-primary-variant (routes/product.js). At most one true
    // per group; falls back to the lowest-priced variant when none is set
    // (the pre-existing default behavior, which is what made an arbitrary
    // variant like "black" show up on the listing before this existed).
    is_primary_variant: {
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

ProductFeaturedTag.hasMany(Product, { foreignKey: 'featured_tag_id' });
Product.belongsTo(ProductFeaturedTag, { foreignKey: 'featured_tag_id', as: 'featured_tag' });

module.exports = Product;
