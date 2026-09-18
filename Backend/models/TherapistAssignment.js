const mongoose = require("mongoose");

const therapistAssignmentSchema = new mongoose.Schema(
  {
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
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
      default:"",
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

module.exports = mongoose.model(
  "TherapistAssignment",
  therapistAssignmentSchema
);
