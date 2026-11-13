
const mongoose = require("mongoose");

const Permission = require("../models/Permission");
const PermissionGroup = require("../models/PermissionGroup");
const UserPermission = require("../models/UserPermission");
const User = require("../models/User");

const validId = (id) => mongoose.isValidObjectId(id);

const isAdmin = (req) =>
  ["admin"].includes(
    String(req.user?.role || "").toLowerCase()
  );

const adminOnly = (req, res, next) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }

  next();
};

const normalizeKeys = (keys) =>
  [...new Set(
    (Array.isArray(keys) ? keys : [])
      .map((key) => String(key).trim().toLowerCase())
      .filter(Boolean)
  )];

const validatePermissionIds = async (ids) => {
  if (!Array.isArray(ids)) return null;

  const uniqueIds = [...new Set(ids.map(String))];

  if (!uniqueIds.every(validId)) return null;

  const count = await Permission.countDocuments({
    _id: { $in: uniqueIds },
    isActive: true,
  });

  return count === uniqueIds.length ? uniqueIds : null;
};

// ==========================================
// PERMISSIONS
// ==========================================

exports.getPermissions = [
  adminOnly,
  async (req, res) => {
    try {
      const permissions = await Permission.find()
        .sort({ module: 1, name: 1 })
        .lean();

      return res.json({
        success: true,
        data: permissions,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch permissions.",
      });
    }
  },
];

exports.createPermission = [
  adminOnly,
  async (req, res) => {
    try {
      const { key, name, module, description = "" } = req.body;

      const cleanKey = String(key || "").trim().toLowerCase();

      if (
        !/^[a-z0-9]+([._:-][a-z0-9]+)*$/.test(cleanKey) ||
        !name?.trim() ||
        !module?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid key, name and module are required.",
        });
      }

      const permission = await Permission.create({
        key: cleanKey,
        name: name.trim(),
        module: module.trim(),
        description: String(description).trim(),
      });

      return res.status(201).json({
        success: true,
        message: "Permission created successfully.",
        data: permission,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "This permission key already exists.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to create permission.",
      });
    }
  },
];
exports.updatePermission = [
  adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, module, description, isActive } = req.body;

      if (!validId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid permission ID.",
        });
      }

      const permission = await Permission.findById(id);

      if (!permission) {
        return res.status(404).json({
          success: false,
          message: "Permission not found.",
        });
      }

      if (name !== undefined) permission.name = name.trim();
      if (module !== undefined) permission.module = module.trim();
      if (description !== undefined) {
        permission.description = String(description).trim();
      }
      if (isActive !== undefined) {
        permission.isActive = Boolean(isActive);
      }

      await permission.save();

      return res.json({
        success: true,
        message: "Permission updated successfully.",
        data: permission,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update permission.",
      });
    }
  },
];

// ==========================================
// PERMISSION GROUPS
// ==========================================

exports.getPermissionGroups = [
  adminOnly,
  async (req, res) => {
    try {
      const groups = await PermissionGroup.find()
        .populate("permissions")
        .sort({ type: 1, name: 1 })
        .lean();

      return res.json({
        success: true,
        data: groups,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch permission groups.",
      });
    }
  },
];

exports.createPermissionGroup = [
  adminOnly,
  async (req, res) => {
    try {
      const { name, description = "", permissions = [] } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Group name is required.",
        });
      }

      const permissionIds = await validatePermissionIds(permissions);

      if (!permissionIds) {
        return res.status(400).json({
          success: false,
          message: "One or more permissions are invalid or inactive.",
        });
      }

      const group = await PermissionGroup.create({
        name: name.trim(),
        description: String(description).trim(),
        permissions: permissionIds,
        type: "custom",
      });

      return res.status(201).json({
        success: true,
        message: "Permission group created successfully.",
        data: group,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create permission group.",
      });
    }
  },
];

exports.updatePermissionGroup = [
  adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, permissions, isActive } = req.body;

      if (!validId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid group ID.",
        });
      }

      const group = await PermissionGroup.findOne({
        _id: id,
        type: "custom",
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Custom permission group not found.",
        });
      }

      if (name !== undefined) {
        if (!name.trim()) {
          return res.status(400).json({
            success: false,
            message: "Group name cannot be empty.",
          });
        }
        group.name = name.trim();
      }

      if (description !== undefined) {
        group.description = String(description).trim();
      }

      if (permissions !== undefined) {
        const permissionIds = await validatePermissionIds(permissions);

        if (!permissionIds) {
          return res.status(400).json({
            success: false,
            message: "One or more permissions are invalid or inactive.",
          });
        }

        // Replaces the group's permissions.
        // All assigned users receive this change automatically.
        group.permissions = permissionIds;
      }

      if (isActive !== undefined) {
        group.isActive = Boolean(isActive);
      }

      await group.save();

      return res.json({
        success: true,
        message: "Permission group updated successfully.",
        data: group,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update permission group.",
      });
    }
  },
];

exports.deletePermissionGroup = [
  adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!validId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid group ID.",
        });
      }

      const group = await PermissionGroup.findOne({
        _id: id,
        type: "custom",
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Custom permission group not found.",
        });
      }

      // Remove all assignments before deleting the group.
      await UserPermission.deleteMany({ groupId: group._id });
      await group.deleteOne();

      return res.json({
        success: true,
        message: "Permission group deleted successfully.",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete permission group.",
      });
    }
  },
];

// ==========================================
// DEFAULT MANAGER PERMISSIONS
// ==========================================

exports.getManagerDefaultPermissions = [
  adminOnly,
  async (req, res) => {
    try {
      const group = await PermissionGroup.findOne({
        type: "default",
        appliesToRole: "Manager",
      }).populate("permissions");

      return res.json({
        success: true,
        data: group,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch default permissions.",
      });
    }
  },
];

exports.updateManagerDefaultPermissions = [
  adminOnly,
  async (req, res) => {
    try {
      const { permissions, description = "" } = req.body;

      const permissionIds = await validatePermissionIds(permissions);

      if (!permissionIds) {
        return res.status(400).json({
          success: false,
          message: "One or more permissions are invalid or inactive.",
        });
      }

      const group = await PermissionGroup.findOneAndUpdate(
        {
          type: "default",
          appliesToRole: "Manager",
        },
        {
          $set: {
            name: "Manager Default Permissions",
            description,
            permissions: permissionIds,
            type: "default",
            appliesToRole: "Manager",
            isActive: true,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      ).populate("permissions");

      return res.json({
        success: true,
        message: "Manager default permissions updated.",
        data: group,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update default permissions.",
      });
    }
  },
];

// ==========================================
// ASSIGN / REMOVE GROUPS FROM MANAGERS
// ==========================================

exports.getUserPermissionGroups = [
  adminOnly,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!validId(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID.",
        });
      }

      const user = await User.findOne({
        _id: userId,
        role: "Manager",
      }).select("_id fullName email role");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Manager not found.",
        });
      }

      const assignments = await UserPermission.find({ userId })
        .populate({
          path: "groupId",
          match: { type: "custom" },
          populate: { path: "permissions" },
        })
        .lean();

      return res.json({
        success: true,
        user,
        data: assignments
          .filter((item) => item.groupId)
          .map((item) => item.groupId),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch user permission groups.",
      });
    }
  },
];

exports.assignPermissionGroup = [
  adminOnly,
  async (req, res) => {
    try {
      const { userId, groupId } = req.params;

      if (!validId(userId) || !validId(groupId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user or group ID.",
        });
      }

      const [user, group] = await Promise.all([
        User.findOne({ _id: userId, role: "Manager" }).select("_id"),
        PermissionGroup.findOne({
          _id: groupId,
          type: "custom",
          isActive: true,
        }).select("_id"),
      ]);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Manager not found.",
        });
      }

      if (!group) {
        return res.status(404).json({
          success: false,
          message: "Active custom permission group not found.",
        });
      }

      await UserPermission.updateOne(
        { userId, groupId },
        {
          $setOnInsert: {
            userId,
            groupId,
            assignedBy: req.user.id || req.user._id,
          },
        },
        { upsert: true }
      );

      return res.json({
        success: true,
        message: "Permission group assigned successfully.",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to assign permission group.",
      });
    }
  },
];

exports.removePermissionGroup = [
  adminOnly,
  async (req, res) => {
    try {
      const { userId, groupId } = req.params;

      if (!validId(userId) || !validId(groupId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user or group ID.",
        });
      }

      await UserPermission.deleteOne({ userId, groupId });

      return res.json({
        success: true,
        message: "Permission group removed from user.",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to remove permission group.",
      });
    }
  },
];
