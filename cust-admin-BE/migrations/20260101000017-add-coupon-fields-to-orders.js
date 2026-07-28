'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('orders', 'coupon_code', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'discount_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('orders', 'discount_amount');
    await queryInterface.removeColumn('orders', 'coupon_code');
  }
};
