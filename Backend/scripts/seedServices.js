require("dotenv").config();
const mongoose = require("mongoose");
const Service = require("../models/Service");

const SEED = [
  {
    label: "Speech Therapy Department",
    color: "#C2410C",
    bg: "#FFEDD5",
  },
  {
    label: "ABA Therapy",
    color: "#991B1B",
    bg: "#FCA5A5",
  },
  {
    label: "Occupational Therapy",
    color: "#065F46",
    bg: "#6EE7B7",
  },
  {
    label: "Physiotherapy",
    color: "#854D0E",
    bg: "#FDE047",
  },
  {
    label: "Inclusive Education",
    color: "#1D4ED8",
    bg: "#DBEAFE",
  },
];

const seedServices = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    for (const service of SEED) {
      await Service.updateOne(
        { label: service.label },
        { $setOnInsert: service },
        { upsert: true }
      );
    }

    console.log("Services seeded successfully");
  } catch (error) {
    console.error("Error seeding services:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedServices();
