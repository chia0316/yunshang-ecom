'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('orders', 'order_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true
    });

    // Backfill existing orders with the same ORD-{year}-{padded id} format
    // used for new orders going forward, derived from their own id/created_at
    // so every order (old and new) ends up with a stable, unique number.
    await queryInterface.sequelize.query(`
      UPDATE orders
      SET order_number = 'ORD-' || EXTRACT(YEAR FROM created_at) || '-' || LPAD(id::text, 5, '0')
      WHERE order_number IS NULL
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('orders', 'order_number');
  }
};
