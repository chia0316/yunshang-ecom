const { Model, DataTypes } = require('sequelize');
const db = require('../database/connection');

// A shared, reusable door-entry code, not one-time-use per appointment — one
// image covers a date range (valid_from..valid_until) and is emailed to
// every appointment confirmed while it's the currently active code. See
// routes/enquiries.js POST /:id/confirm for how "currently active" is
// resolved.
class QrCode extends Model {}
QrCode.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    image_filename: {
      type: DataTypes.STRING,
      allowNull: false
    },
    valid_from: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    valid_until: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    // Manual early retirement (e.g. a leaked code) — distinct from natural
    // expiry via valid_until.
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize: db,
    modelName: 'qrCode',
    tableName: 'qr_codes',
    underscored: true,
    timestamps: true
  }
);

module.exports = QrCode;
