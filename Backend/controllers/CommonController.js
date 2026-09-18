const User = require("../models/User");
const TherapistAssignment = require("../models/TherapistAssignment");

exports.getUsersByRole = async (req, res) => {
  try {
    const { role, search = "", child, therapistId } = req.query;

    const allowedRoles = ["Therapist", "Child"];

    if (!role) {
      return res.status(400).json({ success: false, message: "Role is required." });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role. Use Therapist or Child." });
    }

    const filter = { role };

    if (role === "Therapist" && child) {
      const assignments = await TherapistAssignment.find({ childIds: child }).select("therapistId");
      const assignedTherapistIds = assignments.map((a) => a.therapistId);

      if (assignedTherapistIds.length === 0) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      filter._id = { $in: assignedTherapistIds };
    }

    if (search.trim()) {
      filter.fullName = { $regex: search.trim(), $options: "i" };
    }

    const users = await User.find(filter, { _id: 1, fullName: 1, role: 1 })
      .sort({ fullName: 1 })
      .limit(5);
      
    let responseData = users;
    if (role === "Child" && therapistId) {
      const assignment = await TherapistAssignment.findOne({ therapistId }).select("childIds");
      const assignedSet = new Set((assignment?.childIds || []).map((id) => id.toString()));

      responseData = users.map((u) => ({
        ...u.toObject(),
        isAssigned: assignedSet.has(u._id.toString()),
      }));
    }

    return res.status(200).json({ success: true, count: responseData.length, data: responseData });
  } catch (error) {
    console.log("Get Users By Role Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch users.", error: error.message });
  }
};
