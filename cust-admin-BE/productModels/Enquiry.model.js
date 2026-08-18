const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');

class Enquiry extends Model {}
Enquiry.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('appointment', 'appointment_no_sales', 'enquiry', 'other'),
      allowNull: false,
      defaultValue: 'enquiry'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    mobile: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    preferred_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    preferred_time: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('new', 'contacted', 'closed'),
      allowNull: false,
      defaultValue: 'new'
    }
  },
  {
    sequelize: db,
    modelName: 'enquiry',
    tableName: 'enquiries',
    underscored: true,
    timestamps: true
  }
);

module.exports = Enquiry;
