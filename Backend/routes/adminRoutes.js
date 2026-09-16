const express = require("express");
const router = express.Router();
const { protect, checkRole } = require("../middleware/authMiddleware");
const { getAdminOverview, getTherapistsUsers } = require("../controllers/adminController");

router.get("/overview",  getAdminOverview);
router.get("/get_therapists",  getTherapistsUsers);

module.exports = router;
