const mongoose = require("mongoose");

const weeklyVideoSchema = new mongoose.Schema(
  {
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Therapist",
      required: true,
    },
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
    },
    title: {
      type: String,
      trim: true,
      default: "Live Session",
    },
    tag: {
      type: String,
      trim: true,
      default: "Live Session",
    },
    videoUrl: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      default: "00:45",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("WeeklyVideo", weeklyVideoSchema);
