'use strict';

// Homepage's "Shop by Category" section curates 4 fixed categories (Beds,
// Sofas, Dining Furniture, Mobility Aids) — Sofas and Mobility Aids didn't
// exist yet, so seed them here rather than relying on an admin to create
// them by hand post-deploy. ON CONFLICT DO NOTHING keeps this idempotent
// against the categories.name unique constraint.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `INSERT INTO categories (name, created_at, updated_at)
       VALUES ('Sofas', NOW(), NOW()), ('Mobility Aids', NOW(), NOW())
       ON CONFLICT (name) DO NOTHING`
    );
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('categories', {
      name: ['Sofas', 'Mobility Aids']
    });
  }
};
