const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["per-session", "batch"],
      required: true,
      index: true,
    },

    specialities: {
      type: [String],
      required: true,
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: "At least one speciality is required.",
      },
    },

    price: {
      type: Number,
      required: true,
      min: 1,
    },

    sessionMinutes: {
      type: Number,
      default: 60,
      min: 1,
    },

    sessions: {
      type: Number,
      default: 1,
      min: 1,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

packageSchema.index({
  name: 1,
  type: 1,
});
packageSchema.pre("validate", function () {
  if (this.type === "per-session" && this.specialities.length !== 1) {
    this.invalidate(
      "specialities",
      "Per-session package must have exactly one speciality."
    );
  }

  if (this.type === "batch" && this.specialities.length < 1) {
    this.invalidate(
      "specialities",
      "Batch package must have at least one speciality."
    );
  }
});


module.exports = mongoose.model("Package", packageSchema);
