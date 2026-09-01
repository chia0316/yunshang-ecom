'use strict';

// Slot capacity is now admin-configurable (see appointment_slots_per_hour
// in Settings), so a hard "exactly one booking per slot" DB constraint is
// the wrong tool — replaced by a per-slot advisory-lock + count check in
// routes/enquiries.js POST /, which can enforce any capacity, not just 1.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS enquiries_appointment_slot_unique');
  },
  down: async () => {
    // Not recreating it — by the time anyone rolls this back, real data may
    // already have more than one booking in a slot (that's the whole point
    // of this change), which the old unique index would immediately reject.
  }
};
