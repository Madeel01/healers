const express = require("express");
const { getServicesPublic, getDoctorPublic } = require("../controllers/publicController");
const router = express.Router();

router.get("/services", getServicesPublic);
router.post("/doctors", getDoctorPublic);

module.exports = router;