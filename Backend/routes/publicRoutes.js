const express = require("express");
const { getServicesPublic, getDoctorPublic, getTherapistAvailableSlots } = require("../controllers/publicController");
const router = express.Router();

router.get("/services", getServicesPublic);
router.post("/doctors", getDoctorPublic);
router.post("/doctors-slots", getTherapistAvailableSlots);

module.exports = router;