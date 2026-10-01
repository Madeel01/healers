const mongoose = require("mongoose");

const therapistAssignmentSchema = new mongoose.Schema(
  {
    // batchId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Batch",
    //   required: true,
    // },
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    childIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    specialty: {
      type: String,
      required: false,
      trim: true,
    },

    maxChildren: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);
// therapistAssignmentSchema.index(
//   { batchId: 1, therapistId: 1, specialty: 1 },
//   { unique: true }
// );

module.exports = mongoose.model(
  "TherapistAssignment",
  therapistAssignmentSchema
);
