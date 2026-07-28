'use strict';

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('settings', [
      {
        key: 'free_delivery_threshold',
        value: '500',
        created_at: now,
        updated_at: now
      }
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('settings', {
      key: ['free_delivery_threshold']
    });
  }
};
