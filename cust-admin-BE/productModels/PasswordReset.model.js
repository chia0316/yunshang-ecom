const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');

class PasswordReset extends Model {}
PasswordReset.init(
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
    reset_string: {
      type: DataTypes.STRING,
      allowNull: false
    },
    expiry_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  },
  {
    sequelize: db,
    modelName: 'passwordreset',
    tableName: 'password_resets',
    underscored: true,
    timestamps: true
  }
);

module.exports = PasswordReset;
