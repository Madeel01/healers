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
  updateGoalProgress,
  getChildSessionStats,
  getFeedbackManagementData,
  createFeedback,
  getAttendance,
  updateAttendanceStatus,
  getDashboardStats,
  createLeaveRequest,
  getLeaveRequests,
  getVideosByChild,
  createWeeklyVideo,
  deleteWeeklyVideo
} = require("../controllers/therapistController");
router.get('/dashboard-stats', protect, getDashboardStats);
router.get("/get_therapist_user", protect, getTherapistUser);
router.get("/get_child_programs/:childId", protect, getChildPrograms);
router.post("/delete_program/:programId/add_goal", protect, addGoalToProgram);
router.post("/add_programs", protect, AddPrograms);
router.delete("/delete_program/:programId", protect, deleteProgram);
router.delete("/delete_program/:programId/goal/:goalId", protect, deleteGoal);
router.patch("/program/:programId/goal/:goalId/progress", protect, updateGoalProgress );
router.get("/get_child_stats/:childId", protect, getChildSessionStats);
router.get("/feedback_management/:childId", protect, getFeedbackManagementData);
router.post("/feedback/create", protect, createFeedback);
router.get("/get_attendance", protect, getAttendance);
router.patch("/update_attendance_status", protect, updateAttendanceStatus);
router.post('/leave-request/create', protect, createLeaveRequest);
router.get('/leave-requests/get', protect, getLeaveRequests);
router.get("/video/child/:childId", protect, getVideosByChild);
router.post("/video/create", protect, createWeeklyVideo);
router.delete("/video/delete/:id", protect, deleteWeeklyVideo);
module.exports = router;