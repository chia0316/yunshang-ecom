'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'lead_time_days', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('products', 'lead_time_days');
  }
};
