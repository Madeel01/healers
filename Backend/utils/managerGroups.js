const mongoose = require("mongoose");
const PermissionGroup = require("../models/PermissionGroup");
const UserPermission = require("../models/UserPermission");

const cleanGroupIds = (ids) =>
  [...new Set((Array.isArray(ids) ? ids : []).map(String))];

const validateGroupIds = async (ids) => {
  if (!ids.every((id) => mongoose.isValidObjectId(id))) return "Invalid group id.";
  if (!ids.length) return null;
  const count = await PermissionGroup.countDocuments({
    _id: { $in: ids },
    type: "custom",
    isActive: true,
  });
  return count === ids.length ? null : "Some groups are invalid.";
};

const replaceManagerGroups = async (userId, ids, assignedBy) => {
  await UserPermission.deleteMany({ userId });
  if (ids.length) {
    await UserPermission.insertMany(
      ids.map((groupId) => ({ userId, groupId, assignedBy: assignedBy || null })),
    );
  }
};

module.exports = { cleanGroupIds, validateGroupIds, replaceManagerGroups };