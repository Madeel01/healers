const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    repliedByRole: {
      type: String,
      required: true,
      enum: ["Child", "Therapist","Admin"],
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
const feedbackSchema = new mongoose.Schema(
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
    replies: [replySchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Feedback", feedbackSchema);
