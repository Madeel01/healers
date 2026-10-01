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
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

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
module.exports = router;
