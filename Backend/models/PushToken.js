
const mongoose = require("mongoose");

const pushTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    pushToken: {
      type: String,
      required: true,
      unique: true,
    },

    platform: {
      type: String,
      enum: ["android", "ios"],
      required: true,
    },

    lastRegisteredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PushToken", pushTokenSchema);
