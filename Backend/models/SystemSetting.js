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

    workingDays: {
      type: [String],
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    singletonKey: { type: String, default: "main", unique: true, immutable: true },
  },
  { timestamps: true }
);

systemSettingSchema.pre("validate", function () {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const cs = this.clinicStartTime;
  const ce = this.clinicEndTime;

  if (cs && ce && toMinutes(ce) <= toMinutes(cs)) {
    this.invalidate("clinicEndTime", "Clinic end time must be after start time.");
  }
});

module.exports = mongoose.model("SystemSetting", systemSettingSchema);