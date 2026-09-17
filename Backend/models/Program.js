const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true,
  },
  title: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "in_progress", "completed"],
    default: "pending",
  },
  progress: {
    type: Number,
    default: 0,
    min: [0, "Progress cannot be less than 0"],
    max: [100, "Progress cannot exceed 100"],
  },
});

const programSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    programName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    therapistTitle: {
      type: String,
      default: "Therapist",
    },
    therapistDescription: {
      type: String,
      default: "",
    },
    programGoals: [goalSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Program", programSchema);