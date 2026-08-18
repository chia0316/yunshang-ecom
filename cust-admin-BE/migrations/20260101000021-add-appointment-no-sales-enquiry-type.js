'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_enquiries_type\" ADD VALUE IF NOT EXISTS 'appointment_no_sales'"
    );
  },
  down: async () => {
    // Postgres has no DROP VALUE for enums — removing a value would require
    // rebuilding the type from scratch. Not worth it for a down-migration;
    // leaving the extra enum value in place on rollback is harmless.
  }
};
