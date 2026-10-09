const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, permissions: user.permissions },
    process.env.JWT_SECRET,
    { expiresIn: "3d" },
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
    const { identifier, password, rememberMe } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: "Please provide credentials." });
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
    });

    if (!user) {
      return res.status(401).json({ message: "User not register." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    user.isLogin = true;
    await user.save();

    const token = generateToken(user);
    if (rememberMe && user.email) {
      sendEmail({
        to: user.email,
        subject: "New Login Alert - MobileApp Healer",
        html: `
      <h2>New Login Detected</h2>
      <p>Hello ${user.fullName},</p>
      <p>Your MobileApp Healer account was logged in.</p>
      <p>Time: ${new Date().toUTCString()}</p>
      <p>If this was not you, please reset your password.</p>
    `,
      }).catch((error) => {
        console.error("Login alert email failed:", error);
      });
    }
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
        profileImage: user.profileImage,
        age: user.age,
        fatherCnic: user.fatherCnic,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.switchUser = async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    const { userId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const currentUser = await User.findById(currentUserId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Current user not found",
      });
    }

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      !currentUser.fatherCnic
      || !targetUser.fatherCnic
      || currentUser.fatherCnic !== targetUser.fatherCnic
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot switch to this user",
      });
    }

    currentUser.isLogin = false;
    await currentUser.save();

    targetUser.isLogin = true;
    await targetUser.save();

    const token = generateToken(targetUser);

    return res.status(200).json({
      success: true,
      message: "User switched successfully",
      token,
      user: {
        id: targetUser._id,
        fullName: targetUser.fullName,
        email: targetUser.email,
        phone: targetUser.phone,
        role: targetUser.role,
        permissions: targetUser.permissions,
        profileImage: targetUser.profileImage,
        age: targetUser.age,
        fatherCnic: targetUser.fatherCnic,
      },
    });
  } catch (error) {
    console.log("switchUser error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
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

exports.updateOnlineStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { isOnline } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isOnline: Boolean(isOnline),
        lastActive: new Date(),
      },
      {
        returnDocument: "after",
      },
    ).select("_id isOnline lastActive");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      isOnline: user.isOnline,
      lastActive: user.lastActive,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update online status",
      error: error.message,
    });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      fullName,
      email,
      phone,
      profileImage,
      password,
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (fullName !== undefined) {
      user.fullName = fullName.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      if (normalizedEmail !== user.email) {
        const existingEmail = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: userId },
        });

        if (existingEmail) {
          return res.status(409).json({
            success: false,
            message: "Email is already in use",
          });
        }

        user.email = normalizedEmail;
      }
    }

    if (phone !== undefined) {
      const normalizedPhone = phone.trim();

      const existingPhone = await User.findOne({
        phone: normalizedPhone,
        _id: { $ne: userId },
      });

      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: "Phone number is already in use",
        });
      }

      user.phone = normalizedPhone;
    }

    if (profileImage !== undefined) {
      user.profileImage = profileImage;
    }

    if (password && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions: user.permissions,
        profileImage: user.profileImage,
        age: user.age,
        fatherCnic: user.fatherCnic,
      },
    });
  } catch (error) {
    console.error("updateMyProfile error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.deleteChildProfileImage = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const imageUrl = user.profileImage;

    if (!imageUrl) {
      return res.json({
        success: true,
        message: "Profile image already removed",
        user,
      });
    }

    try {
      const uploadIndex = imageUrl.indexOf("/upload/");

      if (uploadIndex !== -1) {
        let publicId = imageUrl.substring(
          uploadIndex + "/upload/".length,
        );
        publicId = publicId.replace(/^v\d+\//, "");
        publicId = publicId.replace(/\.[^/.]+$/, "");
        console.log("Deleting Cloudinary public_id:", publicId);

        await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
        });
      }
    } catch (cloudinaryError) {
      console.error(
        "Cloudinary delete error:",
        cloudinaryError,
      );
    }

    user.profileImage = "";

    await user.save();

    return res.json({
      success: true,
      message: "Profile image deleted successfully",
      user,
    });
  } catch (error) {
    console.error(
      "Delete profile image error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete profile image",
    });
  }
};

exports.getUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const count = await Notification.countDocuments({
      status: "sent",
      recipients: {
        $elemMatch: {
          user: userId,
          readAt: null,
          isDelete: false,
        },
      },
    });

    return res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("getUnreadNotificationCount:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get unread notification count",
    });
  }
};

exports.getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const notifications = await Notification.find({
      status: "sent",
      recipients: {
        $elemMatch: {
          user: new mongoose.Types.ObjectId(userId),
          readAt: null,
          isDelete: false,
        },
      },
    })
      .populate("createdBy", "fullName email role")
      .sort({ createdAt: -1 })
      .lean();

    const formattedNotifications = notifications.map((notification) => {
      const recipient = notification.recipients?.find(
        (item) => String(item.user) === String(userId),
      );

      return {
        ...notification,
        recipient: recipient || null,
        recipients: undefined,
      };
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error(
      "getUnreadNotifications error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get unread notifications",
      error: error.message,
    });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { notificationId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(notificationId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const result = await Notification.updateOne(
      {
        _id: notificationId,
        recipients: {
          $elemMatch: {
            user: new mongoose.Types.ObjectId(userId),
            isDelete: false,
          },
        },
      },
      {
        $set: {
          "recipients.$.readAt": new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error(
      "markNotificationAsRead error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const result = await Notification.updateMany(
      {
        recipients: {
          $elemMatch: {
            user: new mongoose.Types.ObjectId(userId),
            readAt: null,
            isDelete: false,
          },
        },
      },
      {
        $set: {
          "recipients.$[recipient].readAt": new Date(),
        },
      },
      {
        arrayFilters: [
          {
            "recipient.user": new mongoose.Types.ObjectId(userId),
            "recipient.readAt": null,
            "recipient.isDelete": false,
          },
        ],
      },
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error(
      "markAllNotificationsAsRead error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
      error: error.message,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter your email address.",
      });
    }

    // Check if email exists in MongoDB
    const user = await User.findOne({ email });

    if (!user) {
      console.log("❌ Email not registered:", email);

      return res.status(404).json({
        success: false,
        message: "This email is not registered.",
      });
    }

    console.log("✅ Registered email found:", email);

    const otp = crypto.randomInt(100000, 1000000).toString();

    user.resetPasswordOtpHash = await bcrypt.hash(otp, 10);
    user.resetPasswordOtpExpires = new Date(
      Date.now() + 5 * 60 * 1000,
    );
    user.resetPasswordAttempts = 0;

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Password Reset Verification Code",
      html: `
        <h2>MobileApp Healer</h2>
        <p>Hello ${user.fullName},</p>
        <p>Your password reset code is:</p>
        <h1>${otp}</h1>
        <p>This code expires in 5 minutes.</p>
        <p>If you did not request this, ignore this email.</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Verification code sent successfully.",
    });
  } catch (error) {
    console.error("❌ Forgot Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send verification code.",
    });
  }
};

exports.verifyResetOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const otp = String(req.body.otp || "");

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Enter a valid 6-digit code.",
      });
    }

    const user = await User.findOne({ email })
      .select("+resetPasswordOtpHash +resetPasswordOtpExpires +resetPasswordAttempts");

    if (
      !user
      || !user.resetPasswordOtpHash
      || !user.resetPasswordOtpExpires
      || user.resetPasswordOtpExpires.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        message: "Invalid or expired verification code.",
      });
    }

    if (user.resetPasswordAttempts >= 5) {
      return res.status(429).json({
        message: "Too many attempts. Request a new code.",
      });
    }

    const valid = await bcrypt.compare(
      otp,
      user.resetPasswordOtpHash,
    );

    if (!valid) {
      user.resetPasswordAttempts += 1;
      await user.save();

      return res.status(400).json({
        message: "Invalid or expired verification code.",
      });
    }

    user.resetPasswordOtpHash = null;
    user.resetPasswordOtpExpires = null;
    user.resetPasswordAttempts = 0;
    user.resetPasswordVersion += 1;

    await user.save();

    // Short-lived token that authorizes password reset only.
    const resetToken = jwt.sign(
      {
        id: user._id.toString(),
        purpose: "password-reset",
        version: user.resetPasswordVersion,
      },
      process.env.RESET_TOKEN_SECRET,
      { expiresIn: "5m" },
    );

    return res.json({
      message: "OTP verified successfully.",
      resetToken,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({
      message: "Unable to verify code.",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (
      typeof newPassword !== "string"
      || newPassword.length < 8
    ) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(
        resetToken,
        process.env.RESET_TOKEN_SECRET,
      );
    } catch {
      return res.status(401).json({
        message: "Reset session expired. Request a new code.",
      });
    }

    if (decoded.purpose !== "password-reset") {
      return res.status(401).json({
        message: "Invalid reset session.",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: decoded.id,
        resetPasswordVersion: decoded.version,
      },
      {
        $set: {
          password: await bcrypt.hash(newPassword, 10),
          resetPasswordOtpHash: null,
          resetPasswordOtpExpires: null,
          resetPasswordAttempts: 0,
          isLogin: false,
          isOnline: false,
        },
        $inc: { resetPasswordVersion: 1 },
      },
      { new: true },
    );

    if (!user) {
      return res.status(401).json({
        message: "Reset session is invalid or already used.",
      });
    }

    return res.json({
      message: "Password changed successfully. Please login.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      message: "Unable to reset password.",
    });
  }
};
