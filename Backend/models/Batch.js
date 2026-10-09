const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    batchName: {
      type: String,
      required: true,
      trim: true,
    },
    speciality: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one speciality is required.",
      },
    },
    dateFrom: {
      type: Date,
      required: true,
    },
    dateTo: {
      type: Date,
      required: true,
    },
    maxChild: {
      type: Number,
      required: true,
      min: 1,
    },
    therapistIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    childrenIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    packageIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Package",
        },
      ],
      // validate: {
      //   validator: (arr) => Array.isArray(arr) && arr.length > 0,
      //   message: "At least one package is required.",
      // },
    },
  },
  { timestamps: true }
);
batchSchema.index({ childrenIds: 1, dateFrom: 1, dateTo: 1 });

module.exports = mongoose.model("Batch", batchSchema);