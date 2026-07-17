'use strict';

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('delivery_slots', [
      {
        name: 'Morning',
        time_range: '9am - 12pm',
        sort_order: 1,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        name: 'Afternoon',
        time_range: '12pm - 4pm',
        sort_order: 2,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        name: 'Evening',
        time_range: '4pm - 8pm',
        sort_order: 3,
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('delivery_slots', {
      name: ['Morning', 'Afternoon', 'Evening']
    });
  }
};
