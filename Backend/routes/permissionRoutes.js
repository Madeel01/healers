const express = require("express");
const router = express.Router();

const {
  protect,
} = require("../middleware/authMiddleware");

const {
  getPermissions,
  createPermission,
  updatePermission,

  getPermissionGroups,
  createPermissionGroup,
  updatePermissionGroup,
  deletePermissionGroup,

  getManagerDefaultPermissions,
  updateManagerDefaultPermissions,

  getUserPermissionGroups,
  assignPermissionGroup,
  removePermissionGroup,
} = require("../controllers/permissionController");

router.get("/", protect, getPermissions);
router.post("/", protect, createPermission);
router.put("/:id", protect, updatePermission);

router.get("/groups", protect, getPermissionGroups);
router.post("/groups", protect, createPermissionGroup);
router.put("/groups/:id", protect, updatePermissionGroup);
router.delete("/groups/:id", protect, deletePermissionGroup);

router.get("/manager-default", protect, getManagerDefaultPermissions);

router.put("/manager-default", protect, updateManagerDefaultPermissions);

router.get("/users/:userId/groups", protect, getUserPermissionGroups);

router.post("/users/:userId/groups/:groupId", protect, assignPermissionGroup);

router.delete("/users/:userId/groups/:groupId", protect, removePermissionGroup);

module.exports = router;
