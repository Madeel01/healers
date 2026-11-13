
const mongoose = require("mongoose");

const permissionGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],

    type: {
      type: String,
      enum: ["default", "custom"],
      default: "custom",
    },

    appliesToRole: {
      type: String,
      enum: ["Manager", null],
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

permissionGroupSchema.index(
  { appliesToRole: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: "default",
      appliesToRole: "Manager",
    },
  }
);

module.exports = mongoose.model(
  "PermissionGroup",
  permissionGroupSchema
);
