'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('orders', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'deleted_by_admin_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('orders', 'deleted_by_admin_id');
    await queryInterface.removeColumn('orders', 'deleted_at');
  }
};
