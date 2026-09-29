const mongoose = require("mongoose");
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const systemSettingSchema = new mongoose.Schema(
  {
    clinicName: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    timezone: {
      type: String,
      trim: true,
      default: "Asia/Karachi",
    },

    clinicStartTime: {
      type: String, 
      required: true,
      match: [TIME_REGEX, "clinicStartTime must be in HH:mm 24-hour format."],
      default: "09:00",
    },
    clinicEndTime: {
      type: String, 
      required: true,
      match: [TIME_REGEX, "clinicEndTime must be in HH:mm 24-hour format."],
      default: "17:00",
    },

    breakStartTime: {
      type: String,
      match: [TIME_REGEX, "breakStartTime must be in HH:mm 24-hour format."],
      default: "13:00",
    },
    breakEndTime: {
      type: String,
      match: [TIME_REGEX, "breakEndTime must be in HH:mm 24-hour format."],
      default: "14:00",
    },

    workingDays: {
      type: [String],
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
  },
  { timestamps: true }
);

systemSettingSchema.pre("validate", function () {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  if (this.clinicStartTime && this.clinicEndTime) {
    if (toMinutes(this.clinicEndTime) <= toMinutes(this.clinicStartTime)) {
      throw new Error("clinicEndTime must be after clinicStartTime.");
    }
  }

  if (this.breakStartTime && this.breakEndTime) {
    if (toMinutes(this.breakEndTime) <= toMinutes(this.breakStartTime)) {
      throw new Error("breakEndTime must be after breakStartTime.");
    }
    if (
      this.clinicStartTime &&
      this.clinicEndTime &&
      (toMinutes(this.breakStartTime) < toMinutes(this.clinicStartTime) ||
        toMinutes(this.breakEndTime) > toMinutes(this.clinicEndTime))
    ) {
      throw new Error("Break time must fall within clinic working hours.");
    }
  }
});

module.exports = mongoose.model("SystemSetting", systemSettingSchema);