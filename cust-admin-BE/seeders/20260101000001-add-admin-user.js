'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface) => {
    const email = process.env.ADMIN_EMAIL || 'admin@yunshang.sg';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe@123';

    await queryInterface.bulkInsert(
      'users',
      [
        {
          username: 'admin',
          password: await bcrypt.hash(password, 12),
          first_name: 'Admin',
          last_name: '-',
          email,
          mobile: null,
          is_admin: true,
          status: 'Active',
          last_login_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        }
      ]
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', { username: 'admin' });
  }
};
