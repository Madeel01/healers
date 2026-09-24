const { default: mongoose } = require("mongoose");
const Feedback = require("../models/Feedback");
const LeaveRequest = require("../models/LeaveRequest");
const Scheduling = require("../models/Scheduling");
const TherapistAssignment = require("../models/TherapistAssignment");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Batch = require("../models/Batch");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

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
    const limit = parseInt(req.query.limit) || 3;
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
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ 
      email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } 
    });
    // const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName: name,
      email,
      phone,
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
    const { page = 1, limit = 10, search = "" } = req.query;
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
    const { fullName, fatherName, age, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.json({
        success: false,
        message: "fullName, email, phone and password are required.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const child = await User.create({
      fullName,
      fatherName: fatherName || "",
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
      return res.status(409).json({
        success: false,
        message: "A user with this email or phone already exists.",
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
    const { fullName, fatherName, age, email, phone, password } = req.body;

    const updateFields = {
      ...(fullName && { fullName }),
      ...(fatherName !== undefined && { fatherName }),
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
        message: "A user with this email or phone already exists.",
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
      }
    ).lean();

    const feedbackAppointmentIds = new Set(
      existingFeedbacks.map((feedback) =>
        feedback.appointmentId?.toString()
      )
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
        const hasFeedback = feedbackAppointmentIds.has(
          appointment._id.toString()
        );

        if (alreadyHappened && !hasFeedback) {
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
      data = await Feedback.find({})
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
          new Date(a.session.date) -
          new Date(b.session.date)
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
