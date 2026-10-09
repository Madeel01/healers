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
      // unique: true,
      // sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["Admin", "Therapist", "Parent", "Child"],
      default: "Child",
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
    fatherName: {
      type: String,
      default: "",
      trim: true,
    },
    fatherCnic: { type: String, trim: true, default: "" },
    age: {
      type: Number,
      default: null,
      min: 0,
    },
    profileImage: {
      type: String,
      default: "",
      trim: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastActive: {
      type: Date,
      default: null,
    },
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      default: null,
      index: true,
    },
    discountedPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    isActive: {
      type: Boolean,
      default:false
    },
    resetPasswordOtpHash: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordOtpExpires: {
      type: Date,
      default: null,
      select: false,
    },
    resetPasswordAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    resetPasswordVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);
userSchema.index({ role: 1, fatherCnic: 1 });
module.exports = mongoose.model("User", userSchema);
