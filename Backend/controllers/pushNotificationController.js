const admin = require("../config/firebase");
const PushToken = require("../models/PushToken");
const mongoose = require("mongoose");
const { messaging } = require("../config/firebase");

// Register FCM token
exports.registerPushToken = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { pushToken, platform } = req.body;
    if (
      typeof pushToken !== "string"
      || !pushToken.trim()
      || platform !== "android"
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid Android FCM token required",
      });
    }

    const device = await PushToken.findOneAndUpdate(
      { pushToken },
      {
        $set: {
          userId,
          platform,
          lastRegisteredAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Push token registered successfully",
      data: device,
    });
  } catch (error) {
    console.error("Register push token:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register push token",
    });
  }
};

// Unregister FCM token
exports.unregisterPushToken = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: "Push token required",
      });
    }

    await PushToken.deleteOne({
      userId,
      pushToken,
    });

    return res.status(200).json({
      success: true,
      message: "Push token unregistered successfully",
    });
  } catch (error) {
    console.error("Unregister push token:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to unregister push token",
    });
  }
};

// Reusable service to send push notifications
exports.sendPushToUser = async (userId, payload) => {
  // if (
  //   typeof userId !== "string"
  //   || !/^[0-9a-fA-F]{24}$/.test(userId)
  // ) {
  //   throw new Error("Invalid receiver userId");
  // }

  const devices = await PushToken.find({
    userId: new mongoose.Types.ObjectId(userId),
  })
    .select("pushToken")
    .lean();

  if (!devices.length) {
    return {
      successCount: 0,
      failureCount: 0,
      message: "No registered devices found for this user",
    };
  }

  const tokens = devices.map((device) => device.pushToken);

  const data = Object.fromEntries(
    Object.entries(payload.data || {}).map(([key, value]) => [
      key,
      String(value),
    ]),
  );

  const invalidTokens = [];
  let successCount = 0;
  let failureCount = 0;

  // Firebase supports up to 500 tokens per multicast request
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);

    const result = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data,
      android: {
        priority: "high",
        notification: {
          channelId: "default",
        },
      },
    });

    successCount += result.successCount;
    failureCount += result.failureCount;

    result.responses.forEach((response, index) => {
      if (!response.success) {
        const code = response.error?.code;

        console.error(
          "FCM send failed:",
          code,
          response.error?.message,
        );

        if (
          code === "messaging/registration-token-not-registered"
          || code === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(batch[index]);
        }
      }
    });
  }

  if (invalidTokens.length) {
    await PushToken.deleteMany({
      userId: new mongoose.Types.ObjectId(userId),
      pushToken: { $in: invalidTokens },
    });
  }

  return {
    successCount,
    failureCount,
  };
};

// API endpoint to send notification
exports.sendNotification = async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

    console.log("object", req.body);

    if (
      typeof userId !== "string" ||
      !/^[0-9a-fA-F]{24}$/.test(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid MongoDB userId. Must be 24 hex characters.",
      });
    }

    // Convert string to MongoDB ObjectId
    const objectUserId = new mongoose.Types.ObjectId(userId);

    console.log("Converted User ID:", objectUserId);

    const result = await exports.sendPushToUser(objectUserId, {
      title,
      body,
      data,
    });

    return res.status(200).json({
      success: result.successCount > 0,
      message: "FCM request processed",
      data: result,
    });

  } catch (error) {
    console.error("Send notification:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
