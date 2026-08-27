'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('enquiries', 'qr_code_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'qr_codes',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('enquiries', 'confirmed_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.addIndex('enquiries', ['qr_code_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('enquiries', 'qr_code_id');
    await queryInterface.removeColumn('enquiries', 'confirmed_at');
  }
};
