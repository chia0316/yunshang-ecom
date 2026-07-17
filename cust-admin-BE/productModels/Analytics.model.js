const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');

class Analytics extends Model {}
Analytics.init(
  {
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      primaryKey: true
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    count: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  },
  {
    sequelize: db,
    modelName: 'analytics',
    tableName: 'analytics',
    timestamps: false
  }
);

module.exports = Analytics;
