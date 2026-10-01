const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  status: { type: String, enum: ["scheduled", "cancelled"], default: "scheduled" },
});

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
    sessions: { type: [sessionSchema], default: [] },
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