const User = require("../models/User");

exports.resolveRecipients = async (audience, roles, users, batchIds = []) => {
  if (audience === "all") {
    return User.find({ role: { $in: ["Therapist", "Child", "Admin"] } }, "_id").lean();
  }
  if (audience === "role") {
    return User.find({ role: { $in: roles } }, "_id").lean();
  }
  if (audience === "users") {
    return User.find({ _id: { $in: users } }, "_id").lean();
  }
  if (audience === "batch") {
    const batches = await Batch.find({ _id: { $in: batchIds } }, "childrenIds").lean();
    const ids = [...new Set(batches.flatMap((b) => (b.childrenIds || []).map(String)))];
    if (!ids.length) return [];

    return User.find(
      { _id: { $in: ids }, role: "Child", isActive: { $ne: false } },
      "_id"
    ).lean();
  }
  return [];
}
exports.buildRecipients = (users) => {
  const now = new Date();
  return users.map((u) => ({
    user: u._id,
    deliveredAt: now,
    readAt: null,
    isDelete: false,
  }));
};
