const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    complainantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    complainantRole: {
      type: String,
      enum: ["Therapist", "Child"],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: ["Pending", "Resolved"],
      default: "Pending",
    },

    priority: {
      type: String,
      enum: ["Normal", "High"],
      default: "Normal",
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    messages: [
      {
        senderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        senderRole: {
          type: String,
          enum: ["Admin", "Therapist", "Child"],
          required: true,
        },

        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: 1000,
        },

        readByRecipient: {
          type: Boolean,
          default: false,
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

complaintSchema.index({ status: 1, priority: 1, createdAt: -1 });
complaintSchema.index({ complainantId: 1, createdAt: -1 });

module.exports = mongoose.model("Complaint", complaintSchema);
