const express = require("express");
const router = express.Router();
const { protect, checkRole } = require("../middleware/authMiddleware");

const {
  getTherapistUser,
  getChildPrograms,
  AddPrograms,
  deleteProgram,
  deleteGoal,
  addGoalToProgram,
} = require("../controllers/therapistController");

router.get("/get_therapist_user", protect, getTherapistUser);
router.get("/get_child_programs/:childId", protect, getChildPrograms);
router.post("/delete_program/:programId/add_goal", protect, addGoalToProgram);
router.post("/add_programs", protect, AddPrograms);
router.delete("/delete_program/:programId", protect, deleteProgram);
router.delete("/delete_program/:programId/goal/:goalId", protect, deleteGoal);

module.exports = router;