const mongoose = require("mongoose");

const quarterlyGoalSchema = new mongoose.Schema(
  {
    goalId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    goalName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const quarterlyProgramSchema = new mongoose.Schema(
  {
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    programName: {
      type: String,
      required: true,
      trim: true,
    },

    goals: {
      type: [quarterlyGoalSchema],
      default: [],
    },

    report: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const quarterlyReportSchema = new mongoose.Schema(
  {
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    year: {
      type: Number,
      required: true,
    },

    quarter: {
      type: String,
      required: true,
      enum: ["Q1", "Q2", "Q3", "Q4"],
    },

    programs: {
      type: [quarterlyProgramSchema],
      default: [],
    },

    sentToParents: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["draft", "submitted"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

quarterlyReportSchema.index(
  {
    therapistId: 1,
    userId: 1,
    year: 1,
    quarter: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "QuarterlyReport",
  quarterlyReportSchema
);