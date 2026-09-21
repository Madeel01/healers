const mongoose = require("mongoose");

const weeklyVideoSchema = new mongoose.Schema(
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
      trim: true,
    },

    cloudinaryPublicId: {
      type: String,
      trim: true,
      default: null,
    },

    cloudinaryResourceType: {
      type: String,
      trim: true,
      default: "video",
    },

    videoFormat: {
      type: String,
      trim: true,
      default: null,
    },

    width: {
      type: Number,
      default: null,
    },

    height: {
      type: Number,
      default: null,
    },

    fileSize: {
      type: Number,
      default: 0,
    },

    duration: {
      type: String,
      default: "00:00",
    },

    durationSeconds: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "WeeklyVideo",
  weeklyVideoSchema
);