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
  const bs = this.breakStartTime;
  const be = this.breakEndTime;

  if (cs && ce && toMinutes(ce) <= toMinutes(cs)) {
    this.invalidate("clinicEndTime", "Clinic end time must be after start time.");
  }

  if (!!bs !== !!be) {
    this.invalidate(
      bs ? "breakEndTime" : "breakStartTime",
      "Set both break start and end time, or leave both empty.",
    );
  }

  if (bs && be) {
    if (toMinutes(be) <= toMinutes(bs)) {
      this.invalidate("breakEndTime", "Break end time must be after break start time.");
    } else if (
      cs && ce &&
      (toMinutes(bs) < toMinutes(cs) || toMinutes(be) > toMinutes(ce))
    ) {
      this.invalidate("breakStartTime", "Break must fall within clinic working hours.");
    }
  }
});

module.exports = mongoose.model("SystemSetting", systemSettingSchema);