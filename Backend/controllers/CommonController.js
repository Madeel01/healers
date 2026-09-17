const User = require("../models/User");

exports.getUsersByRole = async (req, res) => {
  try {
    const { role, search = "" } = req.query;

    const allowedRoles = ["Therapist", "Child"];

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required.",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Use Therapist or Child.",
      });
    }

    const filter = {
      role,
    };

    if (search.trim()) {
      filter.fullName = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const users = await User.find(
      filter,
      {
        _id: 1,
        fullName: 1,
        role: 1,
      }
    )
      .sort({ fullName: 1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.log("Get Users By Role Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users.",
      error: error.message,
    });
  }
};
