'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('coupons', 'visibility', {
      type: Sequelize.ENUM('public', 'exclusive'),
      allowNull: false,
      defaultValue: 'public'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('coupons', 'visibility');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_coupons_visibility"');
  }
};
