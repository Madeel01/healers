require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const ADMIN = {
  fullName: "Admin",
  email: "admin@gmail.com",
  password: "test@123",
};

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const existingUser = await User.findOne({
      email: ADMIN.email.toLowerCase().trim(),
    });

    if (existingUser) {
      throw new Error("A user with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(ADMIN.password, 10);

    const admin = await User.create({
      fullName: ADMIN.fullName,
      email: ADMIN.email.toLowerCase().trim(),
      password: hashedPassword,

      phone: "03000000000",
      role: "Admin",
      permissions: [],
      biometricKey: "bio-" + Date.now() + "-" +
        Math.random().toString(36).substring(2, 7),
      agreeTerms: true,
      isLogin: true,
      age: 0,
      fatherName: "",
      fatherCnic: "",
      isOnline: false,
      lastActive: new Date(),
      profileImage: "",
      isActive: true,
      pushTokens: [],
      resetPasswordVersion: 0,
    });

    console.log("Admin created successfully!");
    console.log({
      id: admin._id,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
    });
  } catch (error) {
    console.error("Error creating admin:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();