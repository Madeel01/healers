const express = require("express");
const router = express.Router();

const {
  createSchedule,
  getSchedule,
  addAppointment,
  updateAppointment,
  deleteAppointment,
  getTherapistSchedules,
  getChildSchedules,
} = require("../controllers/SchedulingController");

router.post("/", createSchedule);

router.get("/", getSchedule);

router.post("/appointment", addAppointment);

router.put("/appointment", updateAppointment);

router.delete("/appointment", deleteAppointment);

router.get("/therapist", getTherapistSchedules);

router.get("/child", getChildSchedules);

module.exports = router;