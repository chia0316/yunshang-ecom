'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('product_featured_tags', 'color', {
      type: Sequelize.STRING(7),
      allowNull: false,
      // Matches the hardcoded amber/red badge colors this replaces
      // (admin-FE Badge variant="warning", cust-FE bg-red-500), so existing
      // tags don't suddenly go colorless.
      defaultValue: '#f59e0b'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('product_featured_tags', 'color');
  }
};
