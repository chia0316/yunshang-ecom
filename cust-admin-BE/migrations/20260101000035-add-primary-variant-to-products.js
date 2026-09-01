'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'is_primary_variant', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('products', 'is_primary_variant');
  }
};
