'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('categories', [
      {
        name: 'Dining Furniture',
        description: 'Dining tables, chairs, and related furniture',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Beds',
        description: 'Beds, mattresses, and mobility aids',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('categories', {
      name: ['Dining Furniture', 'Beds']
    });
  }
};
