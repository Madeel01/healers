const express = require("express");
const router = express.Router();

const {
  getChildFeedbackManagement,
  deleteChildFeedback,
  createChildFeedback,
  addChildFeedbackReply,
  getChildFeedbackReplies,
  getAttendance,
  getVideosByChild,
  getAssignMembers,
} = require("../controllers/childController");

const { protect } = require("../middleware/authMiddleware");

router.get("/feedback/:status", protect, getChildFeedbackManagement);
router.delete("/feedback/:feedbackId/reply", protect, deleteChildFeedback);
router.post("/feedback", protect, createChildFeedback);
router.post("/feedback/:feedbackId/reply", protect, addChildFeedbackReply);
router.get("/feedback/replies/:appointmentId", protect, getChildFeedbackReplies);
router.get("/get_ChildAttendance", protect, getAttendance);
router.get("/video/child/:childId", protect, getVideosByChild);
router.get("/assign_therapist", protect, getAssignMembers);


module.exports = router;
