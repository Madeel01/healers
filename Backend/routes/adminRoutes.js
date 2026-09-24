const express = require("express");
const router = express.Router();
const { protect, checkRole } = require("../middleware/authMiddleware");
const { getAdminOverview, getTherapistsUsers, createTherapist, updateTherapist, deleteTherapist, assignChildrenToTherapist, childUsers, createChild, updateChild, deleteChild, getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, getStaffOnLeaveToday, getAdminFeedbackManagement, getFeedbackReplies, addFeedbackReply, getBatches, createBatch, updateBatch, deleteBatch, deleteFeedback } = require("../controllers/adminController");
const { getUsersByRole } = require("../controllers/CommonController");

router.get("/overview",  getAdminOverview);
router.get("/get_therapists",  getTherapistsUsers);
router.get("/users",  getUsersByRole);


router.post("/therapists", protect, createTherapist);
router.put("/therapists/:id", protect, updateTherapist);
router.delete("/therapists/:id", protect , deleteTherapist);
router.post("/therapists/assign", protect, assignChildrenToTherapist);

router.get("/children", protect, childUsers);
router.post("/children", protect, createChild);
router.put("/children/:id", protect, updateChild);
router.delete("/children/:id", protect ,deleteChild);

router.get("/leave-requests", protect,getLeaveRequests);
router.put("/leave-requests/:id/approve", protect,approveLeaveRequest);
router.put("/leave-requests/:id/reject", protect,rejectLeaveRequest);
router.get("/leave-requests/on-leave-today", protect,getStaffOnLeaveToday);

router.get("/feedback/:status", getAdminFeedbackManagement);
router.get("/feedback/:feedbackId/replies",protect,getFeedbackReplies);
router.post("/feedback/:feedbackId/replies",protect,addFeedbackReply);
router.delete("/feedback/:feedbackId", deleteFeedback);

router.get("/batches", protect, getBatches);
router.post("/batches", protect, createBatch);
router.put("/batches/:id", protect, updateBatch);
router.delete("/batches/:id", protect, deleteBatch);

module.exports = router;
