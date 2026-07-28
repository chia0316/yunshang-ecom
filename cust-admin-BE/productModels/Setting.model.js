const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');

// Generic admin-editable key/value store for site settings that need to be
// changed without a redeploy (e.g. free delivery threshold). Values are
// always strings — callers parse to the type they need.
class Setting extends Model {}
Setting.init(
  {
    key: {
      type: DataTypes.STRING(100),
      primaryKey: true,
      allowNull: false
    },
    value: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  },
  {
    sequelize: db,
    modelName: 'setting',
    tableName: 'settings',
    underscored: true,
    timestamps: true
  }
);

module.exports = Setting;
