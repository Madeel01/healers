const { sendBulkPushToUsers } = require("../controllers/pushNotificationController");
const Notification = require("../models/Notification");

exports.sendNotifications = async ({
  title,
  message,
  type = "General",
  audience = "users",
  users = [],
  roles = [],
  createdBy,
  attachment,
  expiresAt,
  sendPush = false
}) => {
  if (!title || !message || !createdBy) {
    throw new Error("title, message, and createdBy are required");
  }

  let recipientIds = [];

  if (audience === "users") {
    recipientIds = [
      ...new Set(users.map((id) => String(id))),
    ];

    if (!recipientIds.length) {
      throw new Error("At least one recipient is required");
    }
  }

  if (audience === "all" || audience === "role") {
    const User = require("../models/User");

    const filter =
      audience === "role"
        ? { role: { $in: roles } }
        : {};

    if (audience === "role" && !roles.length) {
      throw new Error("At least one role is required");
    }

    const recipients = await User.find(filter).select("_id");
    recipientIds = recipients.map((user) => String(user._id));

    if (!recipientIds.length) {
      throw new Error("No recipients found");
    }
  }

  const now = new Date();

  const notification = await Notification.create({
    title,
    message,
    type,
    audience,
    roles: audience === "role" ? roles : [],
    users: audience === "users" ? recipientIds : [],
    recipients: recipientIds.map((id) => ({
      user: id,
      deliveredAt: now,
      readAt: null,
      isDelete: false,
    })),
    createdBy,
    attachment,
    expiresAt,
    status: "sent",
    sentAt: now,
  });
  if (sendPush) {
    const payload = {
      title,
      body: message,
      data: {},
    };

    sendBulkPushToUsers(recipientIds, payload).catch((err) =>
      console.error("Failed to send bulk push notifications:", err)
    );
  }

  return notification;
};