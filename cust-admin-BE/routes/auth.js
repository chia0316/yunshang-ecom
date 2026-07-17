const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");

router.get("/verify", authController.verifyAuth);

module.exports = router;
