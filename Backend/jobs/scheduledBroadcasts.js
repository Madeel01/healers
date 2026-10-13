const cron = require("node-cron");
const Notification = require("../models/Notification");
const { resolveRecipients, buildRecipients } = require("../utils/broadcastHelpers");
const { pushForNotification } = require("../utils/pushService");

let running = false;

async function processDueBroadcasts() {
  if (running) return;
  running = true;

  try {
    while (true) {

      const notification = await Notification.findOneAndUpdate(
        { status: "scheduled", sendAt: { $lte: new Date() } },
        { $set: { status: "sending" } },
        { sort: { sendAt: 1 }, returnDocument: "after" },
      );

      if (!notification) break; 

      try {
        const recipientUsers = await resolveRecipients(
          notification.audience,
          notification.roles,
          notification.users,
          notification.batchIds,
        );
        if (notification.audience === "batch" && !recipientUsers.length) {
          throw new Error("No active children in the selected batches.");
        }
        notification.recipients = buildRecipients(recipientUsers);
        notification.status = "sent";
        notification.sentAt = new Date();
        await notification.save();
      } catch (err) {
        console.error(`Scheduled broadcast ${notification._id} failed:`, err);
        notification.status = "failed";
        await notification.save();
        continue;
      }
      pushForNotification(notification);
    }
  } catch (err) {
    console.error("Scheduled broadcast job error:", err);
  } finally {
    running = false;
  }
}

exports.start = () => {
  cron.schedule("* * * * *", processDueBroadcasts);
  processDueBroadcasts();
};