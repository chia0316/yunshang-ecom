'use strict';

// Homepage card and product listing both display Category.name directly —
// shortening it here is the single change needed for both.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE categories SET name = 'Beds' WHERE name = 'Beds & Mattresses'`
    );
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE categories SET name = 'Beds & Mattresses' WHERE name = 'Beds'`
    );
  }
};
