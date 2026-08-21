'use strict';

// Adds product-variant support: rows sharing the same product_handle are
// variants of the same logical product (e.g. different Material/Color of
// one sofa). Both columns are nullable — a product with no real variants
// just leaves them blank, fully backward compatible with existing rows.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'product_handle', {
      type: Sequelize.STRING(200),
      allowNull: true
    });
    await queryInterface.addColumn('products', 'variant_options', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    await queryInterface.addIndex('products', ['product_handle']);
  },
  down: async (queryInterface) => {
    await queryInterface.removeIndex('products', ['product_handle']);
    await queryInterface.removeColumn('products', 'variant_options');
    await queryInterface.removeColumn('products', 'product_handle');
  }
};
