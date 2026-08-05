'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'dimensions', {
      type: Sequelize.STRING(200),
      allowNull: true
    });
    await queryInterface.addColumn('products', 'video_filename', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('products', 'dimensions');
    await queryInterface.removeColumn('products', 'video_filename');
  }
};
