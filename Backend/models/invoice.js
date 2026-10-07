const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },

    serviceDate: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    duration: {
      type: Number,
      default: 0,
    },

    durationUnit: {
      type: String,
      enum: ["min", "hour", "session"],
      default: "min",
    },

    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },

    rate: {
      type: Number,
      required: true,
      min: 0,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true },
);

const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: [
        "Cash",
        "Bank Transfer",
        "Card",
        "Online",
        "Cheque",
        "Other",
      ],
      default: "Cash",
    },

    reference: {
      type: String,
      default: "",
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    note: {
      type: String,
      default: "",
    },
  },
  { _id: true },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    invoiceDate: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    referenceNumber: {
      type: String,
      default: "",
    },

    items: {
      type: [invoiceItemSchema],
      validate: [
        (items) => items.length > 0,
        "Invoice must contain at least one item",
      ],
    },

    subTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    discountType: {
      type: String,
      enum: ["none", "percentage", "fixed"],
      default: "none",
    },

    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    payments: {
      type: [paymentSchema],
      default: [],
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    balanceDue: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "Draft",
        "Pending",
        "Partially Paid",
        "Paid",
        "Overdue",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },

    clinicalSummary: {
      type: String,
      default: "",
    },

    notes: {
      type: String,
      default: "Thanks for your business.",
    },

    termsAndConditions: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

invoiceSchema.index({ childId: 1, createdAt: -1 });
invoiceSchema.index({ parentId: 1, createdAt: -1 });

module.exports = mongoose.model("Invoice", invoiceSchema);