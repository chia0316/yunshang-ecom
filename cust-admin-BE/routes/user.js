const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const { authenticate, verifyCaptcha } = require('../utils/authenticator');

router.get('/user-data{/:id}', authenticate, userController.userData);

router.post('/signup/:token', verifyCaptcha, userController.signup);
router.post('/login/:token', verifyCaptcha, userController.login);
router.post('/forgetpassword', userController.forgetpassword);
router.post('/resetpassword', userController.resetpassword);

router.put('/update', authenticate, userController.update);
router.put('/update-password', authenticate, userController.updatePassword);

router.delete('/delete', authenticate, userController.deleteUser);

module.exports = router;
