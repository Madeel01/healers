
const PermissionGroup = require("../models/PermissionGroup");
const UserPermission = require("../models/UserPermission");

const getUserId = (user) => user?.id || user?._id;

const getPermissionKeys = async (user) => {
  const role = String(user.role || "").toLowerCase();
  if (role === "admin" || role === "therapist" || role === "child") return ["*"];         
  if (role !== "manager") return [];

  const userId = getUserId(user);
  const assignments = await UserPermission.find({ userId }).select("groupId").lean();
  const assignedGroupIds = assignments.map((a) => a.groupId);

  const groups = await PermissionGroup.find({
    isActive: true,
    $or: [
      { type: "default", appliesToRole: "Manager" },
      { type: "custom", _id: { $in: assignedGroupIds } },
    ],
  })
    .populate({ path: "permissions", match: { isActive: true }, select: "key" })
    .lean();

  const keys = new Set();
  groups.forEach((g) =>
    (g.permissions || []).forEach((p) => p?.key && keys.add(p.key))
  );
  return [...keys];
};

const requirePermission = (...required) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const role = String(req.user.role || "").toLowerCase();
    if (role === "admin" || role === "child" || role === "therapist") return next();
    if (role !== "manager") {
      return res.status(403).json({ success: false, message: "You do not have permission to access this resource." });
    }

    const keys = await getPermissionKeys(req.user);
    if (!required.every((k) => keys.includes(k))) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
        requiredPermissions: required,
      });
    }
    req.userPermissions = keys;
    next();
  } catch (error) {
    console.error("Permission Middleware Error:", error);
    res.status(500).json({ success: false, message: "Failed to verify permissions." });
  }
};

module.exports = requirePermission;
module.exports.getPermissionKeys = getPermissionKeys;
