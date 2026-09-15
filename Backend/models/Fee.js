const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    packageName: {
      type: String,
      required: true,
      trim: true,
    },
    packageDescription: {
      type: String,
      trim: true,
    },
    totalSessions: {
      type: Number,
      default: 1,
    },

    totalFees: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingBalance: {
      type: Number,
      default: function() {
        return this.totalFees - this.paidAmount;
      },
    },
    currency: {
      type: String,
      default: "PKR",
      uppercase: true,
      trim: true,
    },

    startDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Pending", "Partial", "Paid", "Overdue", "Cancelled"],
      default: "Pending",
    },
    // paymentMethod: {
    //   type: String,
    //   enum: ["Credit Card", "Bank Transfer", "Cash", "Stripe", "PayPal", "Other"],
    //   default: "Other",
    // },
    transactionId: {
      type: String,
      default: null,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Fee", feeSchema);
