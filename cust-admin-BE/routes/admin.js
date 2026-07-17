const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin');
const { authenticate } = require('../utils/authenticator');

router.get('/usersList/:status', authenticate, adminController.listUsers);

router.get(
  '/get-user-admin-paging/:status',
  authenticate,
  adminController.getAdminUsersPaging
);

router.get('/customer/:id', authenticate, adminController.getCustomerDetail);
router.put('/updateUserData', authenticate, adminController.updateUserData);
router.delete('/deleteUser/:id', authenticate, adminController.deleteUser);

module.exports = router;
