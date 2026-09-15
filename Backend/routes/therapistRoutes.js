const express = require("express");
const router = express.Router();
const { protect, checkRole } = require("../middleware/authMiddleware");
const { getAdminOverview } = require("../controllers/adminController");

router.get("/overview",  getAdminOverview);

module.exports = router;
