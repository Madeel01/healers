
const mongoose = require("mongoose");

const userPermissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PermissionGroup",
      required: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

userPermissionSchema.index(
  { userId: 1, groupId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "UserPermission",
  userPermissionSchema
);
