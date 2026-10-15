const cron = require("node-cron");
const Notification = require("../models/Notification");
const Batch = require("../models/Batch");
const User = require("../models/User");

const {
  resolveRecipients,
  buildRecipients,
} = require("../utils/broadcastHelpers");

const { sendBulkPushToUsers } = require("../controllers/pushNotificationController");

let running = false;

async function processDueBroadcasts() {
  if (running) return;

  running = true;

  try {
    while (true) {
      const notification = await Notification.findOneAndUpdate(
        {
          status: "scheduled",
          sendAt: { $lte: new Date() },
        },
        {
          $set: { status: "sending" },
        },
        {
          sort: { sendAt: 1 },
          returnDocument: "after",
        }
      );

      if (!notification) break;

      try {
        let recipientUsers = [];

        if (notification.audience === "batch") {
          const batches = await Batch.find({
            _id: { $in: notification.batchIds },
          }).select("childrenIds");

          const childIds = [
            ...new Set(
              batches.flatMap((batch) =>
                batch.childrenIds.map((id) => String(id))
              )
            ),
          ];

          if (!childIds.length) {
            throw new Error(
              "No children currently belong to the selected batches."
            );
          }

          recipientUsers = await User.find({
            _id: { $in: childIds },
          });
        } else {
          recipientUsers = await resolveRecipients(
            notification.audience,
            notification.roles,
            notification.users,
            notification.batchIds
          );
        }

        if (!recipientUsers.length) {
          throw new Error("No recipients found for this broadcast.");
        }

        notification.recipients = buildRecipients(recipientUsers);
        notification.sentAt = new Date();

        await notification.save();
        await sendBulkPushToUsers()

        notification.status = "sent";
        await notification.save();
        const userIds = [
          ...new Set(
            recipientUsers.map((user) =>
              String(user._id || user)
            )
          ),
        ];

        const payload = {
          title: notification.title,
          body: notification.message,
          data: {
            screen: "Notifications",
            notificationId: String(notification._id),
            type: notification.type,
          },
        };

        const pushResult = await sendBulkPushToUsers(
          userIds,
          payload
        );
      } catch (error) {
        console.error(
          `Scheduled broadcast ${notification._id} failed:`,
          error
        );

        notification.status = "failed";
        await notification.save();
      }
    }
  } catch (error) {
    console.error("Scheduled broadcast job error:", error);
  } finally {
    running = false;
  }
}

exports.start = () => {
  cron.schedule("* * * * *", processDueBroadcasts);
  processDueBroadcasts();
};