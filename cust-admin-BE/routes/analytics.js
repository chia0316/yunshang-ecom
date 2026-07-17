const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics");
const { authenticate } = require("../utils/authenticator");

router.get("/analytics", authenticate, analyticsController.getAnalyticsData);

module.exports = router;
