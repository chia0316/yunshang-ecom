'use strict';

// Guarantees at the DB level that two appointment bookings can never share
// the same (date, time) slot — an application-level check-then-insert alone
// can't close the race window between two near-simultaneous submissions.
// Partial index: only applies to appointment-type rows, so general
// enquiries (which don't use preferred_date/preferred_time the same way)
// are unaffected.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX enquiries_appointment_slot_unique
        ON enquiries (preferred_date, preferred_time)
        WHERE type IN ('appointment', 'appointment_no_sales')
    `);
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DROP INDEX enquiries_appointment_slot_unique');
  }
};
