'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('enquiries', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('appointment', 'enquiry', 'other'),
        allowNull: false,
        defaultValue: 'enquiry'
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      mobile: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      preferred_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      preferred_time: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('new', 'contacted', 'closed'),
        allowNull: false,
        defaultValue: 'new'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('enquiries');
  }
};
