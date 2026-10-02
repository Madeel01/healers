const mongoose = require("mongoose");

const batchAssignmentSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },

    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    speciality: {
      type: String,
      required: true,
      trim: true,
    },

    childIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    maxChildren: {
      type: Number,
      default: 1,
      min: 1,
    },
    sessionMinutes: { type: Number, default: 60 },
  },
  { timestamps: true }
);

batchAssignmentSchema.index(
  {
    batchId: 1,
    therapistId: 1,
    speciality: 1,
  },
  { unique: true }
);

module.exports = mongoose.model(
  "BatchAssignment",
  batchAssignmentSchema
);