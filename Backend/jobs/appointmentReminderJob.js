const cron = require("node-cron");
const Scheduling = require("../models/Scheduling");
const { sendBulkPushToUsers } = require(
  "../controllers/pushNotificationController"
);

let running = false;

const REMINDER_MINUTES = 15;

function getAppointmentStart(date, startTime) {
  const day = new Date(date);
  const [hours, minutes] = startTime.split(":").map(Number);

  day.setHours(hours, minutes, 0, 0);

  return day;
}

async function processAppointmentReminders() {
  if (running) return;

  running = true;

  try {
    const now = new Date();

    const windowStart = new Date(
      now.getTime() + (REMINDER_MINUTES - 1) * 60 * 1000
    );

    const windowEnd = new Date(
      now.getTime() + REMINDER_MINUTES * 60 * 1000
    );

    const schedules = await Scheduling.find({
      "appointments.session_status": "Upcoming",
      "appointments.sessionType": {
        $nin: ["cancel", "postponed"],
      },
      "appointments.reminderSentAt": null,
    }).select("therapistId appointments");

    for (const schedule of schedules) {
      for (const appointment of schedule.appointments) {
        try {
          if (appointment.session_status !== "Upcoming") continue;

          if (["cancel", "postponed"].includes(appointment.sessionType)) {
            continue;
          }

          if (appointment.reminderSentAt) continue;

          const appointmentStart = getAppointmentStart(
            appointment.date,
            appointment.startTime
          );

          if (
            appointmentStart <= windowStart ||
            appointmentStart > windowEnd
          ) {
            continue;
          }

          const userIds = [
            String(schedule.therapistId),
            ...appointment.children.map((child) =>
              String(child.childId)
            ),
          ];

          const uniqueUserIds = [...new Set(userIds)];

          const claimed = await Scheduling.updateOne(
            {
              _id: schedule._id,
              appointments: {
                $elemMatch: {
                  _id: appointment._id,
                  session_status: "Upcoming",
                  reminderSentAt: null,
                },
              },
            },
            {
              $set: {
                "appointments.$[appt].reminderSentAt": new Date(),
              },
            },
            {
              arrayFilters: [
                {
                  "appt._id": appointment._id,
                  "appt.reminderSentAt": null,
                  "appt.session_status": "Upcoming",
                },
              ],
            }
          );

          if (!claimed.modifiedCount) continue;

          const payload = {
            title: "Appointment Reminder",
            body: `Your appointment starts in ${REMINDER_MINUTES} minutes.`,
            data: {
              screen: "Notifications",
              type: "appointment_reminder",
              appointmentId: String(appointment._id),
              schedulingId: String(schedule._id),
            },
          };

          try {
            await sendBulkPushToUsers(uniqueUserIds, payload);

            console.log(
              `Appointment reminder sent: ${appointment._id}`
            );
          } catch (pushError) {
            await Scheduling.updateOne(
              { _id: schedule._id },
              {
                $unset: {
                  "appointments.$[appt].reminderSentAt": "",
                },
              },
              {
                arrayFilters: [
                  { "appt._id": appointment._id },
                ],
              }
            );

            throw pushError;
          }
        } catch (error) {
          console.error(
            `Reminder failed for appointment ${appointment._id}:`,
            error.message
          );
        }
      }
    }
  } catch (error) {
    console.error("Appointment reminder job error:", error);
  } finally {
    running = false;
  }
}

exports.start = () => {
  cron.schedule("* * * * *", processAppointmentReminders);
  processAppointmentReminders();
};