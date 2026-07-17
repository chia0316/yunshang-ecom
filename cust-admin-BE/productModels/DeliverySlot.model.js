const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');

class DeliverySlot extends Model {}
DeliverySlot.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    time_range: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize: db,
    modelName: 'deliveryslot',
    tableName: 'delivery_slots',
    underscored: true,
    timestamps: true
  }
);

module.exports = DeliverySlot;
