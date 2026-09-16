const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, permissions: user.permissions },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
};

exports.register = async (req, res) => {
  try {
    const { fullName, email, phone, password, role, permissions, agreeTerms, biometricKey } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Email or phone number is required." });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email || null }, { phone: phone || null }],
    });

    if (existingUser) {
      return res.status(400).json({ message: "User with this email or phone already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName,
      email: email || undefined,
      phone: phone || undefined,
      password: hashedPassword,
      role: role || "Child",
      permissions: permissions || [],
      biometricKey: biometricKey || null,
      agreeTerms,
    });
    const token = generateToken(newUser);
    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        permissions: newUser.permissions,
      },
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Please provide credentials." });
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    user.isLogin = true;
    await user.save();

    const token = generateToken(user);

    res.json({
      message: "Logged in successfully",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.registerBiometric = async (req, res) => {
  try {
    const { biometricKey } = req.body;
    const userId = req.user.id;

    if (!biometricKey) {
      return res.status(400).json({ message: "Biometric key is required." });
    }

    await User.findByIdAndUpdate(userId, { biometricKey });

    res.json({ message: "Biometric key linked successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.loginBiometric = async (req, res) => {
  try {
    const { biometricKey } = req.body;

    if (!biometricKey) {
      return res.status(400).json({ message: "Biometric signature required." });
    }

    const user = await User.findOne({ biometricKey });
    if (!user) {
      return res.status(401).json({ message: "Biometric verification failed or user not registered." });
    }

    const token = generateToken(user);

    res.json({
      message: "Biometric login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.getUsers = async (req, res) => {
  try {
    let { filter = "Child" } = req.body;

    const user = await User.find(
      { role: filter },
      { fullName: 1 }, 
    );
    if (!user) {
      return res.status(401).json({ message: "Invalid Role." });
    }
    res.json({
      message: "successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.getUsers2 = async (req, res) => {
  try {
    let { filter = "Child" } = req.body;

    const user = await User.find(
      { role: filter },
      { fullName: 1 }, 
    );
    if (!user) {
      return res.status(401).json({ message: "Invalid Role." });
    }
    res.json({
      message: "successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

