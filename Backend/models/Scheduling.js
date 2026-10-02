const mongoose = require("mongoose");

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const appointmentChildSchema = new mongoose.Schema(
  {
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    attendance_status: {
      type: String,
      enum: ["Complete", "Absent", "Pending"],
      default: "Pending",
    },
  },
  { _id: true }
);

const appointmentSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "startTime must be HH:mm."],
    },

    endTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "endTime must be HH:mm."],
    },

    type: {
      type: String,
      enum: ["batch", "custom"],
      required: true,
    },

    batchAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BatchAssignment",
      default: null,
    },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },

    sessionType: {
      type: String,
      enum: ["regular", "postponed", "additional", "alternate","cancel"],
      default: "regular",
    },

    originalAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    children: {
      type: [appointmentChildSchema],
      default: [],
    },
  },
  { _id: true }
);

const schedulingSchema = new mongoose.Schema(
  {
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    year: {
      type: Number,
      required: true,
    },

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    appointments: {
      type: [appointmentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

schedulingSchema.index(
  {
    therapistId: 1,
    year: 1,
    month: 1,
  },
  {
    unique: true,
  }
);

schedulingSchema.pre("validate", function () {
  const byDate = {};

  for (const ap of this.appointments) {
    const key = new Date(ap.date).toISOString().slice(0, 10);

    const start = toMin(ap.startTime);
    const end = toMin(ap.endTime);
    if (["cancel", "postponed"].includes(ap.sessionType)) continue;
    if (end <= start) {
      this.invalidate(
        "appointments",
        `End time must be after start time for appointment on ${key}.`
      );
      return;
    }

    const list = (byDate[key] = byDate[key] || []);

    if (list.some((x) => start < x.end && x.start < end)) {
      this.invalidate(
        "appointments",
        `This therapist already has an appointment at that time on ${key}.`
      );
      return;
    }

    list.push({
      start,
      end,
    });
  }
});
schedulingSchema.index({ "appointments.batchId": 1 });
schedulingSchema.index({ "appointments.batchAssignmentId": 1 });
schedulingSchema.index({ "appointments.children.childId": 1 });


module.exports = mongoose.model("Scheduling", schedulingSchema);