const mongoose = require("mongoose");

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const slotSchema = new mongoose.Schema(
  {
    day: { type: String, enum: DAYS, required: true },
    startTime: { type: String, required: true, match: [TIME_REGEX, "startTime must be HH:mm."] },
    endTime: { type: String, required: true, match: [TIME_REGEX, "endTime must be HH:mm."] },
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["recurring", "custom"],
      required: true,
    },

    slots: { type: [slotSchema], default: [] },

    date: {
      type: String,
      match: [DATE_REGEX, "date must be YYYY-MM-DD."],
      default: null,
    },
    effectiveFrom: {
      type: String,
      match: [DATE_REGEX, "effectiveFrom must be YYYY-MM-DD."],
      default: null,
    },
    effectiveTo: {
      type: String,
      match: [DATE_REGEX, "effectiveTo must be YYYY-MM-DD."],
      default: null,
    },
    startTime: {
      type: String,
      match: [TIME_REGEX, "startTime must be HH:mm."],
      default: null,
      required: function () {
        return this.type === "custom";
      },
    },
    endTime: {
      type: String,
      match: [TIME_REGEX, "endTime must be HH:mm."],
      default: null,
      required: function () {
        return this.type === "custom";
      },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

availabilitySchema.pre("validate", function () {
  if (this.type === "recurring" && (!this.slots || this.slots.length === 0)) {
    this.invalidate("slots", "At least one day is required for weekly availability.");
  }
  if (this.type === "custom" && !this.date) {
    this.invalidate("date", "date is required for a specific-date availability.");
  }
});

module.exports = mongoose.model("TherapistAvailability", availabilitySchema);
