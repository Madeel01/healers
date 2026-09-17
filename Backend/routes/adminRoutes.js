const express = require("express");
const router = express.Router();
const { protect, checkRole } = require("../middleware/authMiddleware");
const { getAdminOverview, getTherapistsUsers } = require("../controllers/adminController");
const { getUsersByRole } = require("../controllers/CommonController");

router.get("/overview",  getAdminOverview);
router.get("/get_therapists",  getTherapistsUsers);
router.get("/users",  getUsersByRole);

module.exports = router;
