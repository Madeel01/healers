const express = require("express");
const router = express.Router();
const { protect, checkRole } = require("../middleware/authMiddleware");
const { getAdminOverview, getTherapistsUsers, createTherapist, updateTherapist, deleteTherapist, assignChildrenToTherapist, childUsers, createChild, updateChild, deleteChild, getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, getStaffOnLeaveToday, getAdminFeedbackManagement, getFeedbackReplies, addFeedbackReply, getBatches, createBatch, updateBatch, deleteBatch, deleteFeedback, createBroadcast, getAllBroadcasts, deleteBroadcast, getBroadcastById, updateBroadcast, getComplaints, resolveComplaint, updateComplaintPriority, getComplaintMessages, sendComplaintMessage, getMyNotifications, markNotificationRead, markAllNotificationsRead, getSettings, createSettings, updateSettings, deleteSettings } = require("../controllers/adminController");
const { getUsersByRole, getParents } = require("../controllers/CommonController");
const { uploadBroadcastAttachment } = require("../utils/broadcastUpload");

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

router.post("/broadcast", protect,uploadBroadcastAttachment, createBroadcast);
router.get("/broadcast", protect, getAllBroadcasts);
router.get("/broadcast/:broadcastId", getBroadcastById);
router.put("/broadcast/:broadcastId", uploadBroadcastAttachment, updateBroadcast);
router.delete("/broadcast/:broadcastId",protect, deleteBroadcast);

router.get("/complaints", protect, getComplaints);
router.put("/complaints/:id/resolve", protect, resolveComplaint);
router.put("/complaints/:id/priority", protect, updateComplaintPriority);
router.get("/complaints/:id/messages", protect, getComplaintMessages);
router.post("/complaints/:id/messages", protect, sendComplaintMessage);
router.get("/parents", getParents);

router.get("/notifications", protect, getMyNotifications);
router.put("/notifications/:id/read", protect, markNotificationRead);
router.put("/notifications/read-all", protect, markAllNotificationsRead);

router.get("/settings", getSettings);
router.post("/settings", createSettings);
router.put("/settings", updateSettings);
router.delete("/settings", deleteSettings);

module.exports = router;
