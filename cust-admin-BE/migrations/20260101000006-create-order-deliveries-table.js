'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('order_deliveries', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      delivery_address: {
        type: Sequelize.STRING,
        allowNull: false
      },
      delivery_postal: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      delivery_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      delivery_slot: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      contact: {
        type: Sequelize.STRING,
        allowNull: false
      },
      remarks: {
        type: Sequelize.STRING,
        allowNull: true
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

    await queryInterface.addIndex('order_deliveries', ['order_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('order_deliveries');
  }
};
