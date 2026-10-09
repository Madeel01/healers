const express = require("express");
const router = express.Router();
const {
  register,
  login,
  loginBiometric,
  registerBiometric,
  getUsers,
  updateOnlineStatus,
  switchUser,
  deleteChildProfileImage,
  updateMyProfile,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.post("/register", register);
router.post("/login", login);
router.post("/login-biometric", loginBiometric);
router.post("/register-biometric", protect, registerBiometric);
router.post("/get_user", protect, getUsers);
router.put("/users/online-status", protect, updateOnlineStatus);
router.post("/users/switch-user/:userId", protect, switchUser);
router.put("/users/profile", protect, updateMyProfile);
router.delete("/users/profile-image", protect, deleteChildProfileImage);
router.get("/users/notifications/unread", protect, getUnreadNotifications);
router.post("/users/notifications/:notificationId/read", protect, markNotificationAsRead);
router.post("/users/notifications/read-all", protect, markAllNotificationsAsRead);
router.get("/users/notifications/unread-count", protect, getUnreadNotificationCount);
router.post("/forgot-password", otpLimiter, forgotPassword);
router.post("/verify-reset-otp", otpLimiter, verifyResetOtp);
router.post("/reset-password", resetPassword);
module.exports = router;
