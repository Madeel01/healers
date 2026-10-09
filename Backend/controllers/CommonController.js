const User = require("../models/User");
const TherapistAssignment = require("../models/TherapistAssignment");
const normalizeCnic = (v = "") => {
  const d = String(v).replace(/\D/g, "");
  return d.length === 13 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : null;
};

exports.getUsersByRole = async (req, res) => {
  try {
    const { role, search = "", child, therapistId } = req.query;

    const allowedRoles = ["Therapist", "Child"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Use Therapist or Child.",
      });
    }

    const filter = role
                  ? { role, isActive: true }
                  : {
                      role: { $in: allowedRoles },
                      isActive: true,
                    };

    if (role === "Therapist" && child) {
      const assignments = await TherapistAssignment.find({
        childIds: child,
      }).select("therapistId");

      const assignedTherapistIds = assignments.map(
        (a) => a.therapistId
      );

      if (assignedTherapistIds.length === 0) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
        });
      }

      filter._id = { $in: assignedTherapistIds };
    }

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
      .limit(5)
      .lean();

    let responseData = users;

    if (role === "Child" && therapistId) {
      const assignment = await TherapistAssignment.findOne({
        therapistId,
      }).select("childIds");

      const assignedSet = new Set(
        (assignment?.childIds || []).map((id) => id.toString())
      );

      responseData = users.map((u) => ({
        ...u,
        isAssigned: assignedSet.has(u._id.toString()),
      }));
    }
    if (role === "Therapist" && users.length) {
      const rows = await TherapistAssignment.find(
        {
          therapistId: { $in: users.map((u) => u._id) },
          specialty: { $exists: true, $ne: "" },
        },
        { therapistId: 1, specialty: 1 }
      ).lean();

      const map = new Map();
      for (const r of rows) {
        const key = String(r.therapistId);
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add(r.specialty);
      }

      responseData = users.map((u) => ({
        ...u,
        speciality: [...(map.get(String(u._id)) || [])],
      }));
    }

    return res.status(200).json({
      success: true,
      count: responseData.length,
      data: responseData,
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

exports.getParents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 50);
    const search = (req.query.search || "").trim();

    const match = {
      role: "Child",
      fatherName: { $nin: ["", null] },
      fatherCnic: { $nin: ["", null] },
    };
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      match.$or = [{ fullName: regex }, { fatherName: regex }, { fatherCnic: regex }];
    }

    const rows = await User.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$fatherCnic",
          parentName: { $first: "$fatherName" },
          childCount: { $sum: 1 },
        },
      },
      { $sort: { parentName: 1, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit + 1 },
    ]);

    return res.status(200).json({
      success: true,
      data: rows.slice(0, limit).map((r) => ({
        parentName: r.parentName,
        parentCnic: r._id,
        childCount: r.childCount,
      })),
      hasMore: rows.length > limit,
    });
  } catch (error) {
    console.error("Get Parents Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch parents." });
  }
};
