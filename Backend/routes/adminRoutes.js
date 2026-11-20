const express = require("express");
const router = express.Router();
const { protect, checkRole } = require("../middleware/authMiddleware");
const {
  getAdminOverview,
  getTherapistsUsers,
  createTherapist,
  updateTherapist,
  deleteTherapist,
  assignChildrenToTherapist,
  childUsers,
  createChild,
  updateChild,
  deleteChild,
  getLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  getStaffOnLeaveToday,
  getAdminFeedbackManagement,
  getFeedbackReplies,
  addFeedbackReply,
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  deleteFeedback,
  createBroadcast,
  getAllBroadcasts,
  deleteBroadcast,
  getBroadcastById,
  updateBroadcast,
  getComplaints,
  resolveComplaint,
  updateComplaintPriority,
  getComplaintMessages,
  sendComplaintMessage,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getSettings,
  updateSettings,
  getAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getBatchScheduleData,
  saveBatchSchedule,
  getBatchTherapistOptions,
  getBatchSlotOptions,
  previewBatchSchedule,
  getBatchEligibleChildren,
  updateBatchChildren,
  removeBatchAssignment,
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  assignTherapistsUsers,
  getTherapistSchedule,
  getChildSchedule,
  getChildBatchOptions,
  getChildCustomSlotOptions,
  createChildCustomAppointment,
  deleteChildCustomAppointment,
  deleteBatchSession,
  getSessions,
  getSessionSlotOptions,
  getBatchPackageOptions,
  getServices,
  createService,
  updateService,
  deleteService,
  postponeBatchSession,
  createAdditionalSession,
  getProgramTherapists,
  getProgramTherapistChildren,
  sendFeedbackReminderNotification,
  // markAllLeavesSeen,
  uploadChildDocument,
  getAllUsers,
  createAdmin,
  updateAdmin,
  getChildCustomWeekOptions,
  previewChildCustomSchedule,
  saveChildCustomSchedule,
  cancelChildCustomAppointment,
  postponeChildCustomAppointment,
  adminListQuarterlyReports,
  adminGetQuarterlyReport,
  getAdminAttendance,
  createManager,
  updateManager,
  deleteManager,
  deleteAdmin,
  bulkDeleteAppointments,
  bulkPostponeAppointments,
  bulkCancelAppointments,
  updateAdminAttendance,
} = require("../controllers/adminController");
const { getUsersByRole, getParents } = require("../controllers/CommonController");
const { uploadBroadcastAttachment } = require("../utils/broadcastUpload");
const { getFeeDetails } = require("../controllers/invoiceController");
const requirePermission = require("../middleware/requirePermission");

router.get("/children/:childId/schedule", protect, requirePermission("scheduling"),getChildSchedule);
router.get("/children/:childId/batch-options", protect, getChildBatchOptions);
router.post("/children/:childId/custom-slot-options", protect, requirePermission("scheduling"),getChildCustomSlotOptions);
router.post("/children/:childId/custom-appointments", protect, requirePermission("scheduling"),createChildCustomAppointment);
router.delete("/children/:childId/custom-appointments/:appointmentId", protect, requirePermission("scheduling"),deleteChildCustomAppointment);
router.post("/schedule/bulk-delete", protect, requirePermission("scheduling"),bulkDeleteAppointments);
router.post("/appointments/bulk-cancel", protect, requirePermission("scheduling"),bulkCancelAppointments);
router.post("/children/:childId/custom-week-options", protect, requirePermission("scheduling"),getChildCustomWeekOptions);
router.post("/children/:childId/custom-schedule/preview", protect, requirePermission("scheduling"),previewChildCustomSchedule);
router.post("/children/:childId/custom-schedule", protect, requirePermission("scheduling"),saveChildCustomSchedule);
router.delete(
  "/batches/:batchId/assignments/:assignmentId/sessions/:sessionId",
  protect,
  deleteBatchSession,
);
router.post("/children/documents", protect, requirePermission("children"),uploadChildDocument);
router.post("/children/:childId/custom/:appointmentId/cancel", protect, requirePermission("scheduling"),cancelChildCustomAppointment);
router.post("/children/:childId/custom/:appointmentId/postpone", protect, requirePermission("scheduling"),postponeChildCustomAppointment);
router.post("/appointments/bulk-postpone", protect, requirePermission("scheduling"),bulkPostponeAppointments);

router.get("/schedule", protect, requirePermission("scheduling"),getSessions);
router.get("/overview", protect, getAdminOverview);
router.get("/get_therapists", protect, getTherapistsUsers);
router.get("/get_therapists_child", assignTherapistsUsers);
router.get("/users", protect, getUsersByRole);
router.get("/all_users", protect, checkRole("Admin"),getAllUsers);
router.post("/admins", protect, checkRole("Admin"),createAdmin);
router.put("/admins/:id", protect, checkRole("Admin"),updateAdmin);
router.delete("/admins/:id", protect, checkRole("Admin"),deleteAdmin);
router.post("/manager", protect, checkRole("Admin"),createManager);
router.put("/manager/:id", protect, checkRole("Admin"),updateManager);
router.delete("/manager/:id", protect, checkRole("Admin"),deleteManager);
router.get("/program/therapists", protect, requirePermission("programbuilder"),getProgramTherapists);
router.get("/program/therapists/:therapistId/children", protect, requirePermission("programbuilder"),getProgramTherapistChildren);
router.post("/therapists", protect, requirePermission("therapists"),createTherapist);
router.put("/therapists/:id", protect, requirePermission("therapists"),updateTherapist);
router.delete("/therapists/:id", protect, requirePermission("therapists"),deleteTherapist);
router.post("/therapists/assign", protect, requirePermission("therapists"),assignChildrenToTherapist);
router.get("/therapists/:therapistId/schedule", protect, requirePermission("scheduling"),getTherapistSchedule);
router.get("/children", protect, requirePermission("children"),childUsers);
router.post("/children", protect, requirePermission("children"),createChild);
router.put("/children/:id", protect, requirePermission("children"),updateChild);
router.delete("/children/:id", protect, requirePermission("children"),deleteChild);

router.get("/leave-requests", protect, requirePermission("leaverequest"),getLeaveRequests);
router.put("/leave-requests/:id/approve", protect, requirePermission("leaverequest"),approveLeaveRequest);
router.put("/leave-requests/:id/reject", protect, requirePermission("leaverequest"),rejectLeaveRequest);
router.get("/leave-requests/on-leave-today", protect, requirePermission("leaverequest"),getStaffOnLeaveToday);
// router.patch("/leave-requests/mark-all-seen", markAllLeavesSeen);
router.get("/feedback/:status", protect, requirePermission("feedback"),getAdminFeedbackManagement);
router.get("/feedback/:feedbackId/replies", protect, requirePermission("feedback"),getFeedbackReplies);
router.post("/feedback/:feedbackId/replies", protect, requirePermission("feedback"),addFeedbackReply);
router.post("/feedback/send-reminder", protect, requirePermission("feedback"),sendFeedbackReminderNotification);
router.delete("/feedback/:feedbackId", protect, requirePermission("feedback"),deleteFeedback);

router.get("/batches", protect, getBatches);
router.post("/batches", protect, createBatch);
router.put("/batches/:id", protect, updateBatch);
router.delete("/batches/:id", protect, deleteBatch);
router.get("/batches/batch-packages", protect, getBatchPackageOptions);
router.get("/batches/schedule/:batchId", protect, getBatchScheduleData);
router.get("/batches/:batchId/therapist-options", protect, getBatchTherapistOptions);
router.post("/batches/:batchId/schedule/options", protect, getBatchSlotOptions);
router.post("/batches/:batchId/schedule/preview", protect, previewBatchSchedule);
router.post("/batches/:batchId/schedule", protect, saveBatchSchedule);
router.get("/batches/:batchId/eligible-children", protect, getBatchEligibleChildren);
router.put("/batches/:batchId/children", protect, updateBatchChildren);
router.delete("/batches/:batchId/assignments/:assignmentId", protect, removeBatchAssignment);
router.post("/batches/:batchId/assignments/:assignmentId/slot-options", protect, getSessionSlotOptions);
router.post("/batches/:batchId/assignments/:assignmentId/sessions/:sessionId/postpone", protect, postponeBatchSession);
router.post("/batches/:batchId/assignments/:assignmentId/additional", protect, createAdditionalSession);

router.post("/broadcast", protect, requirePermission("broadcast"),uploadBroadcastAttachment, createBroadcast);
router.get("/broadcast", protect, requirePermission("broadcast"),getAllBroadcasts);
router.get("/broadcast/:broadcastId", protect, requirePermission("broadcast"),getBroadcastById);
router.put("/broadcast/:broadcastId", protect,requirePermission("broadcast"),uploadBroadcastAttachment, updateBroadcast);
router.delete("/broadcast/:broadcastId", protect, requirePermission("broadcast"),deleteBroadcast);

router.get("/complaints", protect, requirePermission("complaints"),getComplaints);
router.put("/complaints/:id/resolve", protect, requirePermission("complaints"),resolveComplaint);
router.put("/complaints/:id/priority", protect, requirePermission("complaints"),updateComplaintPriority);
router.get("/complaints/:id/messages", protect, requirePermission("complaints"),getComplaintMessages);
router.post("/complaints/:id/messages", protect, requirePermission("complaints"),sendComplaintMessage);
router.get("/parents", getParents);

router.get("/notifications", protect, getMyNotifications);
router.put("/notifications/:id/read", protect, markNotificationRead);
router.put("/notifications/read-all", protect, markAllNotificationsRead);

router.get("/scheduling/availability", protect, requirePermission("therapists"),getAvailability);
router.post("/scheduling/availability", protect, requirePermission("therapists"),createAvailability);
router.put("/scheduling/availability/:id", protect, requirePermission("therapists"),updateAvailability);
router.delete("/scheduling/availability/:id", protect, requirePermission("therapists"),deleteAvailability);

router.get("/packages", protect, requirePermission("fees"),getAllPackages);
router.get("/packages/:packageId", protect, requirePermission("fees"),getPackageById);
router.post("/packages/", protect, requirePermission("fees"),createPackage);
router.put("/packages/:packageId", protect, requirePermission("fees"),updatePackage);
router.delete("/packages/:packageId", protect, requirePermission("fees"),deletePackage);

router.get("/services", protect, requirePermission("services"),getServices);
router.post("/services", protect, requirePermission("services"),createService);
router.put("/services/:id", protect, requirePermission("services"),updateService);
router.delete("/services/:id", protect, requirePermission("services"),deleteService);

router.get("/settings", protect, checkRole("Admin"),getSettings);
router.put("/settings", protect, checkRole("Admin"),updateSettings);

router.get("/invoices/fee-details", protect, requirePermission("invoices"),getFeeDetails);

router.get("/quarterly-reports", protect, requirePermission("reports"),adminListQuarterlyReports);
router.get("/quarterly-reports/:id", protect, requirePermission("reports"),adminGetQuarterlyReport);

router.get("/attendance-report", protect, requirePermission("reports"),getAdminAttendance);
router.patch("/attendance", protect, requirePermission("reports"),updateAdminAttendance);

module.exports = router;
