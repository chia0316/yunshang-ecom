'use strict';

// Stock isn't captured anywhere (product form or bulk-upload Excel) — this
// store doesn't track count, so every product is simply available. Existing
// rows previously defaulted to 0 (out of stock) whenever no quantity was
// entered; this backfills them all to the same in-stock sentinel the app
// now uses everywhere a product is created.
const DEFAULT_STOCK_QTY = 999;

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE products SET stock_qty = ${DEFAULT_STOCK_QTY}`
    );
  },

  down: async () => {
    // Not reversible — original per-product quantities weren't meaningful
    // and aren't recoverable.
  }
};
