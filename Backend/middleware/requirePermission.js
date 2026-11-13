
const PermissionGroup = require("../models/PermissionGroup");
const UserPermission = require("../models/UserPermission");

const getUserId = (user) => user?.id || user?._id;

const requirePermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      const role = String(req.user.role || "").toLowerCase();

      if (["Admin"].includes(role)) {
        return next();
      }

      if (role !== "manager") {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource.",
        });
      }

      const userId = getUserId(req.user);

      const assignments = await UserPermission.find({ userId })
        .select("groupId")
        .lean();

      const assignedGroupIds = assignments.map((item) => item.groupId);

      // Get default Manager group + assigned custom groups.
      const groups = await PermissionGroup.find({
        isActive: true,
        $or: [
          {
            type: "default",
            appliesToRole: "Manager",
          },
          {
            type: "custom",
            _id: { $in: assignedGroupIds },
          },
        ],
      })
        .populate({
          path: "permissions",
          match: { isActive: true },
          select: "key",
        })
        .lean();

      const userPermissions = new Set();

      groups.forEach((group) => {
        (group.permissions || []).forEach((permission) => {
          if (permission?.key) {
            userPermissions.add(permission.key);
          }
        });
      });

      // Every permission passed to the middleware must exist.
      const hasAccess = requiredPermissions.every((permission) =>
        userPermissions.has(permission)
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
          requiredPermissions,
        });
      }

      req.userPermissions = [...userPermissions];

      next();
    } catch (error) {
      console.error("Permission Middleware Error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to verify permissions.",
      });
    }
  };
};

module.exports = requirePermission;
