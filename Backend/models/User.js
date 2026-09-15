const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["Admin", "Therapist", "Parent", "Child"],
      default: "Parent",
    },
    permissions: [{
      type: String,
    }],

    biometricKey: {
      type: String,
      default: null,
    },
    agreeTerms: {
      type: Boolean,
      required: true,
    },
    isLogin: {
      type: Boolean,
     default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
