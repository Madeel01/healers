const { default: mongoose } = require("mongoose");
const Feedback = require("../models/Feedback");
const LeaveRequest = require("../models/LeaveRequest");
const Scheduling = require("../models/Scheduling");
const TherapistAssignment = require("../models/TherapistAssignment");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Batch = require("../models/Batch");
const fs = require("fs");
const path = require("path");
const Notification = require("../models/Notification");
const { MIME_TO_TYPE } = require("../utils/broadcastUpload");
const Complaint = require("../models/Complaint");
const SystemSetting = require("../models/SystemSetting");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const POPULATE = [
  { path: "complainantId", select: "fullName role" },
  { path: "resolvedBy", select: "fullName" },
];
const normalizeName = (name) =>
  name?.trim().replace(/\s+/g, " ").toLowerCase();
const normalizeCnic = (v = "") => {
  const d = String(v).replace(/\D/g, "");
  return d.length === 13 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : null;
};

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const settingsToMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const validateSettingsPayload = (body, current, { partial = false } = {}) => {
  const errors = [];
  const out = {};

  for (const field of ["clinicStartTime", "clinicEndTime", "breakStartTime", "breakEndTime"]) {
    if (body[field] === undefined) {
      if (!partial && ["clinicStartTime", "clinicEndTime"].includes(field)) {
        errors.push(`${field} is required.`);
      }
      continue;
    }
    if (!TIME_REGEX.test(body[field])) {
      errors.push(`${field} must be in HH:mm 24-hour format.`);
      continue;
    }
    out[field] = body[field];
  }

  if (body.workingDays !== undefined) {
    if (!Array.isArray(body.workingDays) || body.workingDays.some((d) => !WORKING_DAYS.includes(d))) {
      errors.push(`workingDays must be an array using: ${WORKING_DAYS.join(", ")}.`);
    } else {
      out.workingDays = body.workingDays;
    }
  }

  for (const field of ["clinicName", "address", "phone", "timezone"]) {
    if (body[field] !== undefined) out[field] = String(body[field]).trim();
  }
  if (body.email !== undefined) out.email = String(body.email).trim().toLowerCase();

  const start = out.clinicStartTime ?? current?.clinicStartTime;
  const end = out.clinicEndTime ?? current?.clinicEndTime;
  if (start && end && settingsToMinutes(end) <= settingsToMinutes(start)) {
    errors.push("clinicEndTime must be after clinicStartTime.");
  }

  const breakStart = out.breakStartTime ?? current?.breakStartTime;
  const breakEnd = out.breakEndTime ?? current?.breakEndTime;
  if (breakStart && breakEnd) {
    if (settingsToMinutes(breakEnd) <= settingsToMinutes(breakStart)) {
      errors.push("breakEndTime must be after breakStartTime.");
    } else if (
      start && end &&
      (settingsToMinutes(breakStart) < settingsToMinutes(start) || settingsToMinutes(breakEnd) > settingsToMinutes(end))
    ) {
      errors.push("Break time must fall within clinic working hours.");
    }
  }

  return { errors, data: out };
};



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


exports.getTherapistsUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const { search, specialty } = req.query;

    const matchStage = { role: "Therapist" };

    if (search) {
      matchStage.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "therapistassignments",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toObjectId: "$therapistId" }, "$$userId"] }
              }
            }
          ],
          as: "assignments"
        }
      },
      {
        $project: {
          fullName: 1,
          email: 1,
          phone: 1,
          role: 1,
          isLogin: 1,
          createdAt: 1,
          specialties: "$assignments.specialty",
          maxChildren: { $max: "$assignments.maxChildren" },
          assignedChildren: {
            $sum: {
              $map: {
                input: "$assignments",
                as: "a",
                in: { $size: { $ifNull: ["$$a.childIds", []] } }
              }
            }
          }
        }
      }
    ];

    if (specialty && specialty !== "All") {
      pipeline.push({
        $match: { specialties: specialty }
      });
    }

    pipeline.push({ $skip: skip }, { $limit: limit });

    const therapists = await User.aggregate(pipeline);
    const specialties = await TherapistAssignment.distinct("specialty");

    return res.status(200).json({
      success: true,
      page,
      count: therapists.length,
      hasMore: therapists.length === limit,
      data: therapists,
      specialties: specialties
    });
  } catch (error) {
    console.log("Get Therapists Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get therapists",
      error: error.message
    });
  }
};
exports.createTherapist = async (req, res) => {
  try {
    const { name, specialty, maxChildren, email, phone, address, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }
    const phoneTrimmed = phone.trim();
    const phoneRegex = /^(030\d{8}|\+923\d{9})$/;
    if (!phoneRegex.test(phoneTrimmed)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be in 03011234567 or +923011234567 format.",
      });
    }
    const normalizedPhone = phoneTrimmed.startsWith("+92") ? "0" + phoneTrimmed.slice(3) : phoneTrimmed;

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters and contain 1 lowercase, 1 uppercase, and 1 special character.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName: name,
      email,
      phone:normalizedPhone,
      address,
      role: "Therapist",
      password: hashedPassword,
      agreeTerms:true
    });

    const assignment = await TherapistAssignment.create({
      therapistId: user._id,
      specialty: specialty || "",
      maxChildren: maxChildren && maxChildren > 0 ? parseInt(maxChildren, 10) : 15,
      childIds: [],
    });

    return res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        specialty: assignment.specialty,
        maxChildren: assignment.maxChildren,
        currentLoad: 0,
      },
    });
  } catch (error) {
    console.error("Create Therapist Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create therapist.",
      error: error.message,
    });
  }
};
exports.updateTherapist = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, specialty, maxChildren, email, phone, address, password } = req.body;

    const user = await User.findOne({ _id: id, role: "Therapist" });
    if (!user) {
      return res.status(404).json({ success: false, message: "Therapist not found." });
    }
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });
      }

      const existingUser = await User.findOne({
        _id: { $ne: id },
        email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") }
      });
      if (existingUser) {
        return res.status(400).json({ success: false, message: "An account with this email already exists." });
      }
      user.email = normalizedEmail;
    }
    if (phone) {
      const phoneTrimmed = phone.trim();
      const phoneRegex = /^(030\d{8}|\+923\d{9})$/;
      if (!phoneRegex.test(phoneTrimmed)) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be in 03011234567 or +923011234567 format.",
        });
      }
      user.phone = phoneTrimmed.startsWith("+92") ? "0" + phoneTrimmed.slice(3) : phoneTrimmed;
    }
    if (password) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters and contain 1 lowercase, 1 uppercase, and 1 special character.",
        });
      }
      user.password = await bcrypt.hash(password, 10);
    }

    if (name) user.fullName = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    let assignment = await TherapistAssignment.findOne({ therapistId: id });
    if (assignment) {
      if (specialty !== undefined) assignment.specialty = specialty;
      if (maxChildren !== undefined) assignment.maxChildren = parseInt(maxChildren, 10);
      await assignment.save();
    } else {
      assignment = await TherapistAssignment.create({
        therapistId: user._id,
        specialty: specialty || "",
        maxChildren: maxChildren ? parseInt(maxChildren, 10) : 15,
        childIds: [],
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        specialty: assignment?.specialty,
        maxChildren: assignment?.maxChildren,
      },
    });
  } catch (error) {
    console.error("Update Therapist Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update therapist.",
      error: error.message,
    });
  }
};
exports.deleteTherapist = async (req, res) => {
  try {
    const { id } = req.params;
 
    const user = await User.findOneAndDelete({ _id: id, role: "Therapist" });
    if (!user) {
      return res.status(404).json({ success: false, message: "Therapist not found." });
    }
 
    await TherapistAssignment.deleteOne({ therapistId: id });
 
    return res.status(200).json({ success: true, message: "Therapist deleted." });
  } catch (error) {
    console.error("Delete Therapist Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete therapist.",
      error: error.message,
    });
  }
};
exports.assignChildrenToTherapist = async (req, res) => {
  try {
    const { therapistId } = req.body;
    const addChildIds = Array.isArray(req.body.addChildIds) ? req.body.addChildIds : [];
    const removeChildIds = Array.isArray(req.body.removeChildIds) ? req.body.removeChildIds : [];

    if (!therapistId || (addChildIds.length === 0 && removeChildIds.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "therapistId and at least one of addChildIds/removeChildIds are required.",
      });
    }

    const uniqueAddIds = [...new Set(addChildIds.map((id) => id.toString()))];
    const uniqueRemoveIds = [...new Set(removeChildIds.map((id) => id.toString()))];

    const therapist = await User.findOne({ _id: therapistId, role: "Therapist" });
    if (!therapist) {
      return res.status(404).json({ success: false, message: "Therapist not found." });
    }

    let assignment = await TherapistAssignment.findOne({ therapistId });

    if (!assignment) {
      if (uniqueAddIds.length === 0) {
        return res.status(200).json({
          success: true,
          message: "Nothing to update — no existing assignment and no children to add.",
          data: { therapistId, currentLoad: 0, maxChildren: 0, addedIds: [], removedIds: [] },
        });
      }

      const maxChildren = therapist.maxChildren || 0;

      if (uniqueAddIds.length > maxChildren) {
        return res.status(400).json({
          success: false,
          message: `This therapist can have a maximum of ${maxChildren} children. You tried to assign ${uniqueAddIds.length}.`,
          data: { therapistId, requestedChildren: uniqueAddIds.length, maxChildren, availableSlots: maxChildren },
        });
      }

      assignment = await TherapistAssignment.create({
        therapistId,
        childIds: uniqueAddIds,
        specialty: therapist.specialty || "General",
        maxChildren,
      });

      return res.status(201).json({
        success: true,
        message: `${uniqueAddIds.length} child(ren) assigned successfully.`,
        data: {
          therapistId,
          childIds: assignment.childIds,
          currentLoad: assignment.childIds.length,
          maxChildren: assignment.maxChildren,
          availableSlots: assignment.maxChildren - assignment.childIds.length,
          addedIds: uniqueAddIds,
          removedIds: [],
          alreadyAssigned: 0,
          notAssigned: 0,
        },
      });
    }

    const existing = new Set(assignment.childIds.map((c) => c.toString()));
    const maxChildren = assignment.maxChildren;

    const toRemove = uniqueRemoveIds.filter((id) => existing.has(id));
    const notAssignedForRemoval = uniqueRemoveIds.filter((id) => !existing.has(id));

    const toAdd = uniqueAddIds.filter((id) => !existing.has(id) && !toRemove.includes(id));
    const alreadyAssignedIds = uniqueAddIds.filter((id) => existing.has(id) && !toRemove.includes(id));

    const currentLoad = assignment.childIds.length;
    const projectedLoad = currentLoad - toRemove.length + toAdd.length;

    if (projectedLoad > maxChildren) {
      const availableSlots = Math.max(maxChildren - (currentLoad - toRemove.length), 0);
      return res.status(400).json({
        success: false,
        message: `Only ${availableSlots} slot(s) available for this therapist after removals. You tried to add ${toAdd.length} new child(ren).`,
        data: {
          therapistId,
          currentLoad,
          maxChildren,
          availableSlots,
          attemptedToAdd: toAdd.length,
          attemptedToRemove: toRemove.length,
        },
      });
    }

    if (toAdd.length === 0 && toRemove.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes made — selected children already reflect the current state.",
        data: {
          therapistId,
          childIds: assignment.childIds,
          currentLoad,
          maxChildren,
          availableSlots: maxChildren - currentLoad,
          alreadyAssigned: alreadyAssignedIds.length,
          notAssigned: notAssignedForRemoval.length,
          addedIds: [],
          removedIds: [],
        },
      });
    }

    assignment.childIds = assignment.childIds.filter(
      (c) => !toRemove.includes(c.toString())
    );
    assignment.childIds.push(...toAdd);

    await assignment.save();

    const messageParts = [];
    if (toAdd.length > 0) messageParts.push(`${toAdd.length} child(ren) added`);
    if (toRemove.length > 0) messageParts.push(`${toRemove.length} child(ren) removed`);
    if (alreadyAssignedIds.length > 0) messageParts.push(`${alreadyAssignedIds.length} were already assigned`);
    if (notAssignedForRemoval.length > 0) messageParts.push(`${notAssignedForRemoval.length} were not assigned`);

    return res.status(200).json({
      success: true,
      message: messageParts.join(", ") + ".",
      data: {
        therapistId,
        childIds: assignment.childIds,
        currentLoad: assignment.childIds.length,
        maxChildren,
        availableSlots: maxChildren - assignment.childIds.length,
        addedIds: toAdd,
        removedIds: toRemove,
        alreadyAssigned: alreadyAssignedIds.length,
        notAssigned: notAssignedForRemoval.length,
      },
    });
  } catch (error) {
    console.error("Assign/Unassign Children Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update child assignments.",
      error: error.message,
    });
  }
};



exports.childUsers = async (req, res) => {
  try {
    const { page = 1, limit = 5, search = "" } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const filter = { role: "Child" };
    if (search.trim()) {
      filter.fullName = { $regex: search.trim(), $options: "i" };
    }

    const totalCount = await User.countDocuments(filter);

    const children = await User.find(filter, {
      fullName: 1,
      fatherName: 1,
      fatherCnic: 1,
      age: 1,
      email: 1,
      phone: 1,
    })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      data: children,
      hasMore: pageNum * limitNum < totalCount,
      totalCount,
    });
  } catch (error) {
    console.error("Fetch Children Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch children.",
      error: error.message,
    });
  }
};
exports.createChild = async (req, res) => {
  try {
    const { fullName, fatherName, fatherCnic, age, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password || !fatherName || !fatherCnic) {
      return res.json({
        success: false,
        message: "fullName, email, phone, parent name, parent CNIC and password are required.",
      });
    }

    const cnic = normalizeCnic(fatherCnic);
    if (!cnic) {
      return res.status(400).json({ success: false, message: "CNIC must be 13 digits." });
    }
    const existParent = await User.findOne({
      fatherCnic: cnic,
      role: "Child",
    }).lean();

    if (existParent && normalizeName(existParent.fatherName) !== normalizeName(fatherName)) {
      return res.status(409).json({
        success: false,
        message: "This parent CNIC already exists with a different parent name.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const child = await User.create({
      fullName,
      fatherName: fatherName ,
      fatherCnic: cnic,
      age: age ?? null,
      email,
      phone,
      password: hashedPassword,
      role: "Child",
      agreeTerms: true,
    });

    return res.status(201).json({
      success: true,
      message: "Child created successfully.",
      data: child,
    });
  } catch (error) {
    console.error("Create Child Error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];

      return res.status(409).json({
        success: false,
        message: `A user with this ${field} already exists.`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create child.",
      error: error.message,
    });
  }
};
exports.updateChild = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, fatherName, fatherCnic, age, email, phone, password } = req.body;
    if (!fullName || !email || !phone) {
      return res.json({
        success: false,
        message: "fullName, email and phone are required.",
      });
    }
    const cnic = fatherCnic ? normalizeCnic(fatherCnic) : undefined;
    if (fatherCnic && !cnic) {
      return res.status(400).json({
        success: false,
        message: "CNIC must be 13 digits.",
      });
    }
    if (fatherName !== undefined || fatherCnic !== undefined) {
      const currentChild = await User.findOne({
        _id: id,
        role: "Child",
      }).lean();

      if (!currentChild) {
        return res.json({ success: false, message: "Child not found." });
      }

      const targetCnic = cnic || currentChild.fatherCnic;

      const otherChildren = await User.find({
        role: "Child",
        fatherCnic: targetCnic,
        _id: { $ne: id },
      }).lean();

      if (
        otherChildren.length > 0 &&
        fatherName !== undefined &&
        otherChildren.some(
          (child) =>
            normalizeName(child.fatherName) !== normalizeName(fatherName)
        )
      ) {
        return res.status(409).json({
          success: false,
          message: "This parent CNIC already exists with a different parent name.",
        });
      }
    }
    const updateFields = {
      ...(fullName && { fullName }),
      ...(fatherName !== undefined && { fatherName }),
      ...(fatherCnic !== undefined && { fatherCnic: cnic }),
      ...(age !== undefined && { age }),
      ...(email && { email }),
      ...(phone && { phone }),
    };

    if (password) {
      updateFields.password = await bcrypt.hash(password, 10);
    }

    const child = await User.findOneAndUpdate(
      { _id: id, role: "Child" },
      updateFields,
      { new: true, runValidators: true }
    );

    if (!child) {
      return res.json({ success: false, message: "Child not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Child updated successfully.",
      data: child,
    });
  } catch (error) {
    console.error("Update Child Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update child.",
      error: error.message,
    });
  }
};
exports.deleteChild = async (req, res) => {
  try {
    const { id } = req.params;

    const child = await User.findOneAndDelete({ _id: id, role: "Child" });

    if (!child) {
      return res.json({ success: false, message: "Child not found." });
    }

    await TherapistAssignment.updateMany(
      { childIds: id },
      { $pull: { childIds: id } }
    );

    return res.status(200).json({
      success: true,
      message: "Child deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Child Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete child.",
      error: error.message,
    });
  }
};



const getOnLeaveToday = async () => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);

  const docs = await LeaveRequest.find({
    status: "approved",
    startDate: { $lte: end },
    endDate: { $gte: start },
  })
    .populate("applicantId", "fullName role")
    .sort({ endDate: 1 });

  const seen = new Set();
  return docs.filter((d) => {
    if (!d.applicantId) return false;
    const key = String(d.applicantId._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
exports.getLeaveRequests = async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const filter = {};
    const tab = status.toLowerCase();

    if (tab === "pending") filter.status = "pending";
    else if (tab === "approved") filter.status = "approved";
    else if (tab === "rejected") filter.status = "rejected";

    const totalCount = await LeaveRequest.countDocuments(filter);

    const requests = await LeaveRequest.find(filter)
      .populate("applicantId", "fullName role")
      .populate("approved_by", "fullName")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [pendingCount, pendingSinceYesterday, onLeaveDocs] = await Promise.all([
      LeaveRequest.countDocuments({ status: "pending" }),
      LeaveRequest.countDocuments({ status: "pending", createdAt: { $gte: yesterday } }),
      getOnLeaveToday(),
    ]);

    return res.status(200).json({
      success: true,
      data: requests,
      hasMore: pageNum * limitNum < totalCount,
      totalCount,
      stats: {
        pendingCount,
        pendingSinceYesterday,
        onLeaveToday: onLeaveDocs.length,
        onLeaveNames: onLeaveDocs.map((d) => d.applicantId.fullName),
      },
    });
  } catch (error) {
    console.error("Fetch Leave Requests Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave requests.",
      error: error.message,
    });
  }
};
exports.approveLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id; 

    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      return res.json({
        success: false,
        message: "Leave request not found.",
      });
    }

    if (leaveRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${leaveRequest.status}.`,
      });
    }

    leaveRequest.status = "approved";
    leaveRequest.approved_by = adminId || null;
    leaveRequest.actionedAt = new Date();
    leaveRequest.rejectionReason = ""; 

    await leaveRequest.save();

    return res.status(200).json({
      success: true,
      message: "Leave request approved successfully.",
      data: leaveRequest,
    });
  } catch (error) {
    console.error("Approve Leave Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve leave request.",
      error: error.message,
    });
  }
};
exports.rejectLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user?.id;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required.",
      });
    }

    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      return res.json({
        success: false,
        message: "Leave request not found.",
      });
    }

    if (leaveRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${leaveRequest.status}.`,
      });
    }

    leaveRequest.status = "rejected";
    leaveRequest.rejectionReason = rejectionReason.trim();
    leaveRequest.approved_by = adminId || null;
    leaveRequest.actionedAt = new Date();

    await leaveRequest.save();

    return res.status(200).json({
      success: true,
      message: "Leave request rejected.",
      data: leaveRequest,
    });
  } catch (error) {
    console.error("Reject Leave Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject leave request.",
      error: error.message,
    });
  }
};
exports.getStaffOnLeaveToday = async (req, res) => {
  try {
    const data = await getOnLeaveToday();
    return res.status(200).json({ success: true, data, totalCount: data.length });
  } catch (error) {
    console.error("Staff On Leave Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch staff on leave.",
      error: error.message,
    });
  }
};



exports.getAdminFeedbackManagement = async (req, res) => {
  try {
    const { status } = req.params;

    if (!["all", "pending", "new"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Use all, pending, or new.",
      });
    }

    const now = new Date();

    const startOfYesterday = new Date();
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);

    const ratingResult = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          averageRating: {
            $avg: "$rating",
          },
        },
      },
    ]);

    const averageSatisfaction = ratingResult.length
      ? Number(ratingResult[0].averageRating.toFixed(1))
      : 0;

    const sinceYesterdayFeedback = await Feedback.countDocuments({
      createdAt: {
        $gte: startOfYesterday,
      },
    });

    const existingFeedbacks = await Feedback.find(
      {},
      {
        appointmentId: 1,
        notes: 1,
      }
    ).lean();

    const feedbackMap = new Map(
      existingFeedbacks.map((feedback) => [
        feedback.appointmentId?.toString(),
        feedback,
      ])
    );


    const schedules = await Scheduling.find({})
      .populate("therapistId", "fullName email role")
      .populate("childId", "fullName email role")
      .lean();

    const pendingFeedback = [];

    for (const schedule of schedules) {
      if (!schedule.appointments?.length) {
        continue;
      }

      for (const appointment of schedule.appointments) {
        const appointmentDate = new Date(appointment.date);
        const alreadyHappened = appointmentDate < now;
        // const hasFeedback = feedbackAppointmentIds.has(
        //   appointment._id.toString()
        // );
        const feedback = feedbackMap.get(appointment._id.toString());
        const hasPendingFeedback =
          !feedback ||
          feedback.notes == null ||
          feedback.notes.trim() === "";

        if (alreadyHappened && hasPendingFeedback) {
          pendingFeedback.push({
            appointmentId: appointment._id,
            therapistId: schedule.therapistId,
            childId: schedule.childId,
            session: {
              date: appointment.date,
              startTime: appointment.startTime,
              endTime: appointment.endTime,
              attendanceStatus: appointment.attendance_status,
            },
          });
        }
      }
    }

    let data = [];

    if (status === "all") {
      data = await Feedback.find({
        notes: {
          $nin: [null, ""],
        },
      })
        .populate("therapistId", "fullName email role")
        .populate("childId", "fullName email role")
        .lean()
        .sort({ createdAt: -1 });

      data = data.map((feedback) => {
        const appointment = schedules
          .flatMap((schedule) => schedule.appointments || [])
          .find(
            (appointment) =>
              appointment._id.toString() === feedback.appointmentId?.toString()
          );
        const { replies, ...feedbackData } = feedback;
        return {
          ...feedbackData,
          isRespond: Array.isArray(replies) && replies.length > 0,
          appointment: appointment
            ? {
                startTime: appointment.startTime,
              }
            : null,
        };
      });
    }

    if (status === "new") {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      data = await Feedback.find({
        notes: {
          $nin: [null, ""],
        },
        createdAt: {
          $gte: threeDaysAgo,
        },
      })
        .populate("therapistId", "fullName email role")
        .populate("childId", "fullName email role")
        .lean()
        .sort({ createdAt: -1 });

      data = data.map((feedback) => {
        const appointment = schedules
          .flatMap((schedule) => schedule.appointments || [])
          .find(
            (appointment) =>
              appointment._id.toString() === feedback.appointmentId?.toString()
          );

        return {
          ...feedback,
          appointment: appointment
            ? {
                startTime: appointment.startTime,
              }
            : null,
        };
      });
    }

    if (status === "pending") {
      data = pendingFeedback;

      data.sort(
        (a, b) =>
          new Date(b.session.date) -
          new Date(a.session.date)
      );
    }

    return res.status(200).json({
      success: true,
      status,
      stats: {
        pendingFeedback: pendingFeedback.length,
        sinceYesterdayFeedback,
        averageSatisfaction,
      },
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Admin Feedback Management Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch feedback management data.",
      error: error.message,
    });
  }
};
exports.getFeedbackReplies = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await Feedback.findById(feedbackId)
      .populate("replies.repliedBy", "fullName role email")
      .lean();

    if (!feedback) {
      return res.json({ success: false, message: "Feedback not found." });
    }

    let appt = null;
    if (feedback.appointmentId) {
      const apptId = new mongoose.Types.ObjectId(feedback.appointmentId);
      const schedule = await Scheduling.findOne(
        { "appointments._id": apptId },
        { "appointments.$": 1 } 
      ).lean();

      appt = schedule?.appointments?.[0] || null;
    }

    return res.status(200).json({
      success: true,
      data: {
        feedbackId: feedback._id,
        appointmentId: feedback.appointmentId,
        startTime: appt?.startTime || null,
        endTime: appt?.endTime || null,
        appointmentDate: appt?.date || null,
        attendanceStatus: appt?.attendance_status || null,
        replies: (feedback.replies || []).map((r) => ({
          _id: r._id,
          message: r.message,
          repliedByRole: r.repliedByRole,
          createdAt: r.createdAt,
          repliedBy: {
            id: r.repliedBy?._id,
            name: r.repliedBy?.fullName || "Unknown",
          },
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.addFeedbackReply = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { message } = req.body; 

    if (!message?.trim()) {
      return res.json({
        success: false,
        message: "Reply message is required.",
      });
    }

    const feedback = await Feedback.findById(feedbackId);

    if (!feedback) {
      return res.json({
        success: false,
        message: "Feedback not found.",
      });
    }

    feedback.replies.push({
      repliedBy: req.user.id,
      repliedByRole: req.user.role,
      message: message.trim(),
    });

    await feedback.save();

    const updatedFeedback = await Feedback.findById(feedbackId)
      .populate("replies.repliedBy")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Reply added successfully.",
      data: {
        feedbackId: updatedFeedback._id,
        replies: updatedFeedback.replies,
      },
    });
  } catch (error) {
    console.error("Add Feedback Reply Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add reply.",
      error: error.message,
    });
  }
};
exports.deleteFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await Feedback.findByIdAndDelete(feedbackId);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Feedback deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Feedback Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete feedback.",
      error: error.message,
    });
  }
};




exports.getBatches = async (req, res) => {
  try {
    const { page = 1, limit = 20, speciality } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const filter = {};
    if (speciality) {
      const specialityList = Array.isArray(speciality)
        ? speciality
        : speciality.split(",");
      filter.speciality = { $in: specialityList };
    }

    const totalCount = await Batch.countDocuments(filter);

    const batches = await Batch.find(filter)
      .populate("therapistIds", "fullName email")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      data: batches,
      hasMore: pageNum * limitNum < totalCount,
      totalCount,
    });
  } catch (error) {
    console.error("Get Batches Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch batches.",
      error: error.message,
    });
  }
};
exports.createBatch = async (req, res) => {
  try {
    const { batchName, speciality, dateFrom, dateTo, maxChild, fee } = req.body;
    const specialityList = Array.isArray(speciality) ? speciality : [];
    if (
      !batchName ||
      !specialityList.length ||
      !dateFrom ||
      !dateTo ||
      !maxChild ||
      !fee
    ) {
      return res.status(400).json({
        success: false,
        message:
          "batchName, speciality (at least one), dateFrom, dateTo, Batch fee and Batch Size are required.",
      });
    }

    const batch = await Batch.create({
      batchName: batchName.trim(),
      speciality: specialityList,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      maxChild: parseInt(maxChild, 10),
      fee: parseInt(fee, 10),
    });

    const populated = await batch.populate("therapistIds", "fullName email");

    return res.status(201).json({
      success: true,
      message: "Batch created successfully.",
      data: populated,
    });
  } catch (error) {
    console.error("Create Batch Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create batch.",
      error: error.message,
    });
  }
};
exports.updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { batchName, speciality, dateFrom, dateTo, maxChild, fee } = req.body;

    const batch = await Batch.findById(id);
    if (!batch) {
      return res.json({ success: false, message: "Batch not found." });
    }

    if (batchName !== undefined) batch.batchName = batchName.trim();
    if (speciality !== undefined) {
      batch.speciality = Array.isArray(speciality) ? speciality : [];
    }
    if (dateFrom !== undefined) batch.dateFrom = new Date(dateFrom);
    if (dateTo !== undefined) batch.dateTo = new Date(dateTo);
    if (maxChild !== undefined) batch.maxChild = parseInt(maxChild, 10);
    if (fee !== undefined) batch.fee = parseInt(fee, 10);

    await batch.save();
    const populated = await batch.populate("therapistIds", "fullName email");

    return res.status(200).json({
      success: true,
      message: "Batch updated successfully.",
      data: populated,
    });
  } catch (error) {
    console.error("Update Batch Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update batch.",
      error: error.message,
    });
  }
};
exports.deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await Batch.findByIdAndDelete(id);

    if (!batch) {
      return res.json({ success: false, message: "Batch not found." });
    }

    return res.status(200).json({ success: true, message: "Batch deleted." });
  } catch (error) {
    console.error("Delete Batch Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete batch.",
      error: error.message,
    });
  }
};




async function resolveRecipients(audience, roles, users) {
  if (audience === "all") {
    return User.find({ role: { $in: ["Therapist", "Child","Admin"] } }, "_id").lean();
  }
  if (audience === "role") {
    return User.find({ role: { $in: roles } }, "_id").lean();
  }
  if (audience === "users") {
    return User.find({ _id: { $in: users } }, "_id").lean();
  }
  return [];
}
exports.createBroadcast = async (req, res) => {
  try {
    const { title, message, audience, roles, users, deliverySchedule, sendAt, type } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: "Title and message are required." });
    }
    const VALID_TYPES = ["System", "Appointment", "Therapy", "Message", "Reminder", "Alert", "General"];
    const notifType = VALID_TYPES.includes(type) ? type : "General";
    if (!["all", "role", "users"].includes(audience)) {
      return res.status(400).json({ success: false, message: "Invalid audience." });
    }

    let parsedRoles = [];
    let parsedUsers = [];
    try {
      parsedRoles = roles ? JSON.parse(roles) : [];
      parsedUsers = users ? JSON.parse(users) : [];
    } catch {
      return res.status(400).json({ success: false, message: "roles/users must be valid JSON arrays." });
    }

    if (audience === "role" && parsedRoles.length === 0) {
      return res.status(400).json({ success: false, message: "Select at least one role (Therapist/Child)." });
    }
    if (audience === "users" && parsedUsers.length === 0) {
      return res.status(400).json({ success: false, message: "Select at least one user." });
    }

    let attachment = { url: null, name: null, type: null };
    if (req.file) {
      attachment = {
        url: `/assets/broadcasts/${req.file.filename}`,
        name: req.file.originalname,
        type: MIME_TO_TYPE[req.file.mimetype] || null,
      };
    }

    let status = "draft";
    let finalSendAt = null;

    if (deliverySchedule === "now") {
      status = "sending";
    } else if (deliverySchedule === "later") {
      if (!sendAt) {
        return res.status(400).json({ success: false, message: "sendAt is required for scheduled delivery." });
      }
      status = "scheduled";
      finalSendAt = new Date(sendAt);
    }

    const notification = new Notification({
      title: title.trim(),
      message: message.trim(),
      audience,
      type: notifType,
      roles: audience === "role" ? parsedRoles : [],
      users: audience === "users" ? parsedUsers : [],
      createdBy: req.user.id,
      attachment,
      status,
      sendAt: finalSendAt,
    });

    if (status === "sending") {
      const recipientUsers = await resolveRecipients(audience, parsedRoles, parsedUsers);
      notification.recipients = recipientUsers.map((u) => ({ user: u._id }));
      notification.status = "sent";
      notification.sentAt = new Date();
    }

    await notification.save();

    return res.status(201).json({
      success: true,
      message: status === "draft" ? "Draft saved." : status === "scheduled" ? "Broadcast scheduled." : "Broadcast sent.",
      data: notification,
    });
  } catch (error) {
    console.error("Create Broadcast Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create broadcast.", error: error.message });
  }
};
exports.getAllBroadcasts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status = "", type= "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    if (search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { message: { $regex: search.trim(), $options: "i" } },
      ];
    }
    if (status.trim() && status !== "all") filter.status = status.trim();
    if (type.trim() && type !== "all") filter.type = type.trim();

    const [broadcasts, total] = await Promise.all([
      Notification.find(filter)
        .populate("createdBy", "fullName email role")
        .populate("users", "fullName role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(filter),
    ]);

    const data = broadcasts.map((b) => ({
      ...b,
      recipientCount: b.recipients?.length || 0,
      readCount: b.recipients?.filter((r) => r.readAt).length || 0,
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch broadcasts.", error: error.message });
  }
};
exports.getBroadcastById = async (req, res) => {
  try {
    const { broadcastId } = req.params;
    const broadcast = await Notification.findById(broadcastId)
      .populate("createdBy", "fullName email role")
      .populate("users", "fullName role")
      .lean();

    if (!broadcast) {
      return res.status(404).json({ success: false, message: "Broadcast not found." });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...broadcast,
        recipientCount: broadcast.recipients?.length || 0,
        readCount: broadcast.recipients?.filter((r) => r.readAt).length || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch broadcast.", error: error.message });
  }
};
exports.updateBroadcast = async (req, res) => {
  try {
    const { broadcastId } = req.params;
    const { title, message, audience, type, roles, users, deliverySchedule, sendAt, removeAttachment } = req.body;

    const broadcast = await Notification.findById(broadcastId);
    if (!broadcast) {
      return res.status(404).json({ success: false, message: "Broadcast not found." });
    }
    if (broadcast.status === "sent") {
      return res.status(400).json({ success: false, message: "Sent broadcasts can't be edited." });
    }

    if (title !== undefined) broadcast.title = title.trim();
    if (message !== undefined) broadcast.message = message.trim();
    if (type !== undefined) {
      const VALID_TYPES = ["System", "Appointment", "Therapy", "Message", "Reminder", "Alert", "General"];
      broadcast.type = VALID_TYPES.includes(type) ? type : broadcast.type;
    }
    if (audience !== undefined) {
      if (!["all", "role", "users"].includes(audience)) {
        return res.status(400).json({ success: false, message: "Invalid audience." });
      }
      let parsedRoles = [];
      let parsedUsers = [];
      try {
        parsedRoles = roles ? JSON.parse(roles) : [];
        parsedUsers = users ? JSON.parse(users) : [];
      } catch {
        return res.status(400).json({ success: false, message: "roles/users must be valid JSON arrays." });
      }
      broadcast.audience = audience;
      broadcast.roles = audience === "role" ? parsedRoles : [];
      broadcast.users = audience === "users" ? parsedUsers : [];
    }

    if (deliverySchedule === "now") {
      broadcast.status = "sending";
      broadcast.sendAt = null;
    } else if (deliverySchedule === "later") {
      if (!sendAt) {
        return res.status(400).json({ success: false, message: "sendAt is required for scheduled delivery." });
      }
      broadcast.status = "scheduled";
      broadcast.sendAt = new Date(sendAt);
    } else if (deliverySchedule === "draft") {
      broadcast.status = "draft";
      broadcast.sendAt = null;
    }

    // remove existing attachment if requested
    if (removeAttachment === "true" && broadcast.attachment?.url) {
      const oldPath = path.join(__dirname, "..", broadcast.attachment.url.replace(/^\//, ""));
      fs.unlink(oldPath, () => {});
      broadcast.attachment = { url: null, name: null, type: null };
    }

    // replace attachment if a new file was uploaded
    if (req.file) {
      if (broadcast.attachment?.url) {
        const oldPath = path.join(__dirname, "..", broadcast.attachment.url.replace(/^\//, ""));
        fs.unlink(oldPath, () => {});
      }
      broadcast.attachment = {
        url: `/assets/broadcasts/${req.file.filename}`,
        name: req.file.originalname,
        type: MIME_TO_TYPE[req.file.mimetype] || null,
      };
    }

    if (broadcast.status === "sending") {
      const recipientUsers = await resolveRecipients(broadcast.audience, broadcast.roles, broadcast.users);
      broadcast.recipients = recipientUsers.map((u) => ({ user: u._id }));
      broadcast.status = "sent";
      broadcast.sentAt = new Date();
    }

    await broadcast.save();

    return res.status(200).json({ success: true, message: "Broadcast updated.", data: broadcast });
  } catch (error) {
    console.error("Update Broadcast Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update broadcast.", error: error.message });
  }
};
exports.deleteBroadcast = async (req, res) => {
  try {
    const { broadcastId } = req.params;
    const broadcast = await Notification.findByIdAndDelete(broadcastId);
    if (!broadcast) {
      return res.status(404).json({ success: false, message: "Broadcast not found." });
    }
    if (broadcast.attachment?.url) {
      const filePath = path.join(__dirname, "..", broadcast.attachment.url.replace(/^\//, ""));
      fs.unlink(filePath, () => {}); // best-effort cleanup, no need to block response on it
    }
    return res.status(200).json({ success: true, message: "Broadcast deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete broadcast.", error: error.message });
  }
};



exports.getComplaints = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 10);
    const { status, priority, role } = req.query;
    const search = (req.query.search || "").trim();

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (role) filter.complainantRole = role;

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const users = await User.find({ fullName: regex }, "_id").lean();
      filter.$or = [
        { title: regex },
        { description: regex },
        { complainantId: { $in: users.map((u) => u._id) } },
      ];
    }

    const weekStart = new Date();
    const day = weekStart.getDay() || 7;
    weekStart.setDate(weekStart.getDate() - day + 1);
    weekStart.setHours(0, 0, 0, 0);

    const [total, list, pendingWeek, resolvedWeek] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.find(filter)
        .select("-messages")
        .populate(POPULATE)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Complaint.countDocuments({ status: "Pending", createdAt: { $gte: weekStart } }),
      Complaint.countDocuments({ status: "Resolved", createdAt: { $gte: weekStart } }),
    ]);

    const unread = await Complaint.aggregate([
      { $match: { _id: { $in: list.map((c) => c._id) } } },
      {
        $project: {
          count: {
            $size: {
              $filter: {
                input: "$messages",
                as: "m",
                cond: {
                  $and: [
                    { $ne: ["$$m.senderRole", "Admin"] },
                    { $eq: ["$$m.readByRecipient", false] },
                  ],
                },
              },
            },
          },
        },
      },
    ]);
    const unreadMap = new Map(unread.map((u) => [String(u._id), u.count]));

    return res.status(200).json({
      success: true,
      data: list.map((c) => ({ ...c, unreadCount: unreadMap.get(String(c._id)) || 0 })),
      hasMore: page * limit < total,
      stats: {
        total: await Complaint.countDocuments(),
        pending: pendingWeek,                   
        resolved: resolvedWeek,                
      },
    });
  } catch (error) {
    console.error("Get Complaints Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch complaints." });
  }
};
exports.resolveComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, status: "Pending" },
      {
        status: "Resolved",
        resolvedBy: req.user.id,
        resolvedAt: new Date(),
        resolutionNote: (req.body?.resolutionNote || "").trim().slice(0, 500),
      },
      { new: true, projection: { messages: 0 } }
    ).populate(POPULATE);

    if (!complaint) {
      return res.json({ success: false, message: "Complaint not found or already resolved." });
    }
    return res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    console.error("Resolve Complaint Error:", error);
    return res.status(500).json({ success: false, message: "Failed to resolve complaint." });
  }
};
exports.updateComplaintPriority = async (req, res) => {
  try {
    const { priority } = req.body;
    if (!["High", "Normal"].includes(priority)) {
      return res.status(400).json({ success: false, message: "Priority must be High or Normal." });
    }

    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, status: "Pending" },
      { priority },
      { new: true, projection: { messages: 0 } }
    ).populate(POPULATE);

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found or already resolved." });
    }
    return res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    console.error("Update Priority Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update priority." });
  }
};
exports.getComplaintMessages = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await Complaint.findById(id).select("status messages").lean();
    if (!complaint) {
      return res.json({ success: false, message: "Complaint not found." });
    }

    await Complaint.updateOne(
      { _id: id },
      { $set: { "messages.$[m].readByRecipient": true } },
      { arrayFilters: [{ "m.senderRole": { $ne: "Admin" }, "m.readByRecipient": false }] }
    );

    return res.status(200).json({
      success: true,
      data: {
        status: complaint.status,
        messages: complaint.messages.slice(-200),
      },
    });
  } catch (error) {
    console.error("Get Messages Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch messages." });
  }
};
exports.sendComplaintMessage = async (req, res) => {
  try {
    const text = (req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ success: false, message: "Message cannot be empty." });
    }
    if (text.length > 1000) {
      return res.status(400).json({ success: false, message: "Message can be at most 1000 characters." });
    }

    const updated = await Complaint.findOneAndUpdate(
      { _id: req.params.id, status: "Pending" },
      { $push: { messages: { senderId: req.user.id, senderRole: "Admin", text } } },
      { new: true, projection: { messages: { $slice: -1 } } }
    ).lean();

    if (!updated) {
      const exists = await Complaint.exists({ _id: req.params.id });
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? "This complaint is resolved, chat is read-only." : "Complaint not found.",
      });
    }

    return res.status(201).json({ success: true, data: updated.messages[0] });
  } catch (error) {
    console.error("Send Message Error:", error);
    return res.status(500).json({ success: false, message: "Failed to send message." });
  }
};



exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 15, 50);
    console.log(userId,"id");
    const filter = { status: "sent", "recipients.user": userId };

    const [total, notifications, unreadCount] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .populate("createdBy", "fullName role")
        .sort({ sentAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments({
        ...filter,
        recipients: { $elemMatch: { user: userId, readAt: null } },
      }),
    ]);

    const data = notifications.map((n) => {
      const mine = (n.recipients || []).find((r) => String(r.user) === String(userId));
      const { recipients, ...rest } = n;
      return {
        ...rest,
        isRead: !!mine?.readAt,
        readAt: mine?.readAt || null,
        deliveredAt: mine?.deliveredAt || null,
      };
    });

    return res.status(200).json({
      success: true,
      data,
      hasMore: page * limit < total,
      totalCount: total,
      unreadCount,
    });
  } catch (error) {
    console.error("Get My Notifications Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications.",
      error: error.message,
    });
  }
};
exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, "recipients.user": userId },
      {
        $set: {
          "recipients.$.readAt": new Date(),
        },
        $setOnInsert: {},
      },
      { new: true, projection: { recipients: 1 } }
    );

    if (!notification) {
      return res.json({ success: false, message: "Notification not found." });
    }

    const mine = notification.recipients.find((r) => String(r.user) === String(userId));
    if (!mine?.deliveredAt) {
      await Notification.updateOne(
        { _id: id, "recipients.user": userId },
        { $set: { "recipients.$.deliveredAt": new Date() } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: { id, readAt: mine?.readAt },
    });
  } catch (error) {
    console.error("Mark Notification Read Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read.",
      error: error.message,
    });
  }
};
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      { status: "sent", recipients: { $elemMatch: { user: userId, readAt: null } } },
      { $set: { "recipients.$[r].readAt": new Date() } },
      { arrayFilters: [{ "r.user": userId, "r.readAt": null }] }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      modified: result.modifiedCount ?? result.nModified,
    });
  } catch (error) {
    console.error("Mark All Notifications Read Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read.",
      error: error.message,
    });
  }
};



exports.getSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.findOne().lean();
    if (!settings) {
      return res.json({ success: false, message: "No settings found." });
    }
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("Get Settings Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch settings.", error: error.message });
  }
};
exports.createSettings = async (req, res) => {
  try {
    const existing = await SystemSetting.findOne();
    if (existing) {
      return res.status(409).json({ success: false, message: "Settings already exist. Use update instead." });
    }

    const { errors, data } = validateSettingsPayload(req.body, null, { partial: false });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    const settings = await SystemSetting.create(data);

    return res.status(201).json({ success: true, message: "Settings created.", data: settings });
  } catch (error) {
    console.error("Create Settings Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create settings.", error: error.message });
  }
};
exports.updateSettings = async (req, res) => {
  try {
    const existing = await SystemSetting.findOne();
    if (!existing) {
      return res.json({ success: false, message: "No settings found. Create them first." });
    }

    const { errors, data } = validateSettingsPayload(req.body, existing, { partial: true });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    Object.assign(existing, data);
    await existing.save(); // runs the pre("validate") cross-field checks too

    return res.status(200).json({ success: true, message: "Settings updated.", data: existing });
  } catch (error) {
    console.error("Update Settings Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update settings.", error: error.message });
  }
};
exports.deleteSettings = async (req, res) => {
  try {
    const deleted = await SystemSetting.findOneAndDelete();
    if (!deleted) {
      return res.json({ success: false, message: "No settings found." });
    }

    return res.status(200).json({ success: true, message: "Settings deleted." });
  } catch (error) {
    console.error("Delete Settings Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete settings.", error: error.message });
  }
};
