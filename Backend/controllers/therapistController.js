const User = require("../models/User");

exports.getAdminOverview = async (req, res) => {
  try {
    const [totalChild, therapistCount, totalUsers] = await Promise.all([
      User.countDocuments({ role: "Child" }),
      User.countDocuments({ role: "Therapist" }),
      User.countDocuments(),
    ]);

    const sessionCount = 5; 

    return res.status(200).json({
      success: true,
      data: {
        totalChild,
        therapistCount,
        totalUsers,
        sessionCount,
      },
    });
  } catch (error) {
    console.error("Error fetching admin overview stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard metrics.",
      error: error.message,
    });
  }
};