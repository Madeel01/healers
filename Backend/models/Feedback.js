const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
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
    appointmentId: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      required: true,
    },
    mood: {
      type: String,
      enum: ["Happy", "Neutral", "Sad", "Anxious", "Calm", "Frustrated"],
      default: "Neutral",
    },
    isVisibleToParent: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 5,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Feedback", feedbackSchema);
