const express = require("express");
const router = express.Router();
const {
  register,
  login,
  loginBiometric,
  registerBiometric,
  getUsers,
  updateOnlineStatus,
} = require("../controllers/authController");
const { protect, checkRole, checkPermission } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/login-biometric", loginBiometric);
router.post("/register-biometric", protect, registerBiometric);
router.post("/get_user", protect, getUsers);
router.put("/users/online-status", protect, updateOnlineStatus);


module.exports = router;
