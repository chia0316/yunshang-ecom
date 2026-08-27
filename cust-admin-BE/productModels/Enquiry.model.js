const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');
const QrCode = require('./QrCode.model');

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
    requires_sales_person: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      // 'confirmed' is only ever set via POST /:id/confirm (routes/enquiries.js)
      // — it always comes with a real qr_code_id and a sent email behind it,
      // never settable through the plain PATCH /:id status update.
      type: DataTypes.ENUM('new', 'contacted', 'confirmed', 'closed'),
      allowNull: false,
      defaultValue: 'new'
    },
    // Which shared QR code was emailed when this appointment was confirmed
    // (see QrCode.model.js) — kept even after that code naturally expires,
    // purely for audit/support ("which code did we send this guest").
    qr_code_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true
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

Enquiry.belongsTo(QrCode, { foreignKey: 'qr_code_id' });

module.exports = Enquiry;
