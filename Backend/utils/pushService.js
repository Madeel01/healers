const { Expo } = require("expo-server-sdk");
const User = require("../models/User");

const expo = new Expo();

exports.sendPushToUsers = async (userIds, { title, body, data = {} }) => {
  try {
    const users = await User.find({ _id: { $in: userIds } })
      .select("pushTokens")
      .lean();

    const messages = [];
    for (const u of users) {
      for (const t of u.pushTokens || []) {
        if (!Expo.isExpoPushToken(t.token)) continue;
        messages.push({
          to: t.token,
          sound: "default",
          channelId: "default",
          title,
          body,
          data,
        });
      }
    }
    if (!messages.length) return;

    const dead = [];
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((tk, i) => {
        if (tk.status === "error" && tk.details?.error === "DeviceNotRegistered") {
          dead.push(chunk[i].to);
        }
      });
    }

    if (dead.length) {
      await User.updateMany(
        {},
        { $pull: { pushTokens: { token: { $in: dead } } } },
      );
    }
  } catch (err) {
    console.error("Push send error:", err); 
  }
};

exports.pushForNotification = (n) => {
  const ids = (n.recipients || []).filter((r) => !r.isDelete).map((r) => r.user);
  return exports.sendPushToUsers(ids, {
    title: n.title,
    body: n.message,
    data: { notificationId: String(n._id), type: n.type },
  });
};