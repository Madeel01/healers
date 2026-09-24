const mongoose = require("mongoose");

const recipientSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "System",
        "Appointment",
        "Therapy",
        "Message",
        "Reminder",
        "Alert",
        "General",
      ],
      default: "General",
    },

    audience: {
      type: String,
      enum: ["all", "role", "users"],
      required: true,
    },

    roles: [
      {
        type: String,
        enum: ["Therapist", "Child"],
      },
    ],

    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    recipients: [recipientSchema],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    attachment: {
      url: {
        type: String,
        default: null,
      },
      name: {
        type: String,
        default: null,
      },
      type: {
        type: String,
        enum: ["pdf", "image", "doc", null],
        default: null,
      },
    },

    status: {
      type: String,
      enum: ["draft", "scheduled", "sending", "sent", "cancelled"],
      default: "draft",
    },

    sendAt: {
      type: Date,
      default: null,
    },

    sentAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);