'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('coupons', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      discount_type: {
        type: Sequelize.ENUM('percent', 'fixed'),
        allowNull: false
      },
      discount_value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      min_order_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      max_uses: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      used_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    await queryInterface.dropTable('coupons');
  }
};
