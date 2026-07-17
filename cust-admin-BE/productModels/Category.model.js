const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');

class Category extends Model {}
Category.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true
    },
    sub: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    deleted_on: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize: db,
    modelName: 'category',
    tableName: 'categories',
    underscored: true,
    timestamps: true
  }
);

module.exports = Category;
