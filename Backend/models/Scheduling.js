const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true, 
    },
    status_attendance: {
        type: String,
        enum: ["Complete", "Absent", "Pending"],
        default: "Pending"
    }
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

    childId: {
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
  { timestamps: true }
);


schedulingSchema.index(
  { therapistId: 1, childId: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model("Scheduling", schedulingSchema);
