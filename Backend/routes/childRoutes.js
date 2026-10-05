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
  getAssignTherapist,
  getCNICRegisterSameUser,
  getChildUpcomingSessions,
  getMyComplaints,
  createComplaint,
  getComplaintById,
  addComplaintReply,
  replyComplaint,
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
router.get("/therapist", protect, getAssignTherapist);
router.get("/cnic_user/:cnic", protect, getCNICRegisterSameUser);
router.get("/upcoming-sessions", protect, getChildUpcomingSessions);
router.get("/complaints", protect, getMyComplaints);
router.post("/complaints", protect, createComplaint);
router.get("/complaints/:complaintId", protect, getComplaintById);
router.post("/complaints/:complaintId/reply", protect, replyComplaint);
module.exports = router;
