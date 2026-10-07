const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    color: { type: String, required: true },
    bg: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

serviceSchema.index(
  { label: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Service", serviceSchema);