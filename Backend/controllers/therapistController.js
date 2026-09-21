const mongoose = require("mongoose");
const TherapistAssignment = require("../models/TherapistAssignment");
const User = require("../models/User");
const Program = require("../models/Program");
const Scheduling = require("../models/Scheduling");
const Feedback = require("../models/Feedback");
const LeaveRequest = require("../models/LeaveRequest");
const WeeklyVideo = require("../models/Video");

exports.getDashboardStats = async (req, res) => {
  try {
    const rawTherapistId = req.query.filter || req.user?._id;

    if (!rawTherapistId) {
      return res.status(400).json({
        success: false,
        message: "Therapist ID is required.",
      });
    }

    const therapistId = new mongoose.Types.ObjectId(rawTherapistId);

    const now = new Date();

    const assignment = await TherapistAssignment.findOne({ therapistId }).lean();
    const assignedChildrenList = assignment?.childIds || [];
    const assignedChildrenCount = assignedChildrenList.length;
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const schedules = await Scheduling.find({ therapistId, month: currentMonth, year: currentYear }).populate(
      "childId",
      "name fullName",
    );

    let todaySessionsCount = 0;
    let completedCount = 0;
    let totalFeebBackCount = 0;
    let totalPastOrCurrentSessions = 0;
    let closestUpcomingSession = null;
    let closestTimeDiff = Infinity;
    schedules.forEach((schedule) => {
      (schedule.appointments || []).forEach((appt) => {
        const apptDate = new Date(appt.date?.$date || appt.date);
        const fullApptDateTime = new Date(apptDate);
        totalFeebBackCount++;
        if (appt.startTime) {
          const [hours, minutes] = appt.startTime.split(":").map(Number);
          if (!isNaN(hours) && !isNaN(minutes)) {
            fullApptDateTime.setHours(hours, minutes, 0, 0);
          }
        }

        const isToday = apptDate.getUTCFullYear() === now.getUTCFullYear()
          && apptDate.getUTCMonth() === now.getUTCMonth()
          && apptDate.getUTCDate() === now.getUTCDate();

        if (isToday) {
          todaySessionsCount++;
        }

        if (fullApptDateTime >= now) {
          const diff = fullApptDateTime - now;
          if (diff < closestTimeDiff) {
            closestTimeDiff = diff;
            const childObj = schedule.childId || {};
            closestUpcomingSession = {
              childName: childObj.fullName || childObj.name || "Assigned Child",
              startTime: appt.startTime,
              endTime: appt.endTime,
              date: appt.date,
            };
          }
        }

        const status = appt.attendance_status;
        if (status === "Complete") {
          completedCount++;
          totalPastOrCurrentSessions++;
        } else if (status === "Absent") {
          totalPastOrCurrentSessions++;
        } else if ((status === "Pending" || !status) && fullApptDateTime <= now) {
          totalPastOrCurrentSessions++;
        }
      });
    });

    const overallAttendance = totalPastOrCurrentSessions > 0
      ? Math.round((completedCount / totalPastOrCurrentSessions) * 100)
      : 0;

    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const totalSubmittedFeedback = await Feedback.countDocuments({
      therapistId,
      createdAt: {
        $gte: startOfMonth,
        $lt: startOfNextMonth,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        assignedChildren: assignedChildrenCount,
        todaySessions: todaySessionsCount,
        monthlyFeedback: `${totalSubmittedFeedback}/${totalFeebBackCount}`,
        overallAttendance: `${overallAttendance}%`,
        nextSession: closestUpcomingSession,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTherapistUser = async (req, res) => {
  try {
    const rawTherapistId = req.query.filter || req.user?._id;

    if (!rawTherapistId) {
      return res.status(400).json({
        success: false,
        message: "Therapist ID is required.",
      });
    }

    const therapistId = new mongoose.Types.ObjectId(rawTherapistId);

    const assignment = await TherapistAssignment.findOne({ therapistId }).lean();
    const childIds = assignment?.childIds || [];

    const children = await User.find({
      _id: { $in: childIds },
    })
      .select("-password")
      .lean();

    return res.status(200).json({
      success: true,
      data: children,
    });
  } catch (error) {
    console.error("Error fetching assigned children:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned children.",
      error: error.message,
    });
  }
};

exports.getChildPrograms = async (req, res) => {
  try {
    const { childId } = req.params;
    const therapistId = req.query.therapistId || req.user?._id || req.user?.id;

    if (!childId || !therapistId) {
      return res.status(400).json({
        success: false,
        message: "Both childId and therapistId are required.",
      });
    }

    const programs = await Program.find({
      userId: childId,
      therapistId: therapistId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: programs.length,
      data: programs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.AddPrograms = async (req, res) => {
  try {
    const { therapistId, childId, programName, description, therapistTitle, therapistDescription, goals } = req.body;

    if (!therapistId || !childId || !programName) {
      return res.status(400).json({
        success: false,
        message: "therapistId, childId, and programName are required fields.",
      });
    }

    const formattedGoals = Array.isArray(goals)
      ? goals.map((g) => (typeof g === "string" ? { title: g } : g))
      : [];

    const createdProgram = await Program.create({
      userId: childId,
      therapistId,
      programName,
      description: description || "describe behavior, engagement,",
      therapistTitle: therapistTitle || "Therapist",
      therapistDescription: therapistDescription || "describe behavior, engagement,",
      programGoals: formattedGoals,
    });

    return res.status(201).json({
      success: true,
      program: createdProgram,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addGoalToProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Goal title is required." });
    }

    const updatedProgram = await Program.findByIdAndUpdate(
      programId,
      { $push: { programGoals: { title, status: "pending" } } },
      { new: true },
    );

    if (!updatedProgram) {
      return res.status(404).json({ success: false, message: "Program not found." });
    }

    return res.status(200).json({
      success: true,
      program: updatedProgram,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateGoalProgress = async (req, res) => {
  try {
    const { programId, goalId } = req.params;
    const { progress } = req.body;

    const numericProgress = Number(progress);
    if (isNaN(numericProgress) || numericProgress < 0 || numericProgress > 100) {
      return res.status(400).json({
        success: false,
        message: "Progress must be a number between 0 and 100",
      });
    }

    const updatedProgram = await Program.findOneAndUpdate(
      { _id: programId, "programGoals._id": goalId },
      { $set: { "programGoals.$.progress": numericProgress } },
      { new: true },
    );

    if (!updatedProgram) {
      return res.status(404).json({
        success: false,
        message: "Program or Goal not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Goal progress updated successfully",
      program: updatedProgram,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteProgram = async (req, res) => {
  try {
    const { programId } = req.params;

    const deletedProgram = await Program.findByIdAndDelete(programId);

    if (!deletedProgram) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Program removed",
      programId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const { programId, goalId } = req.params;
    console.log("req", req.params);
    const updatedProgram = await Program.findByIdAndUpdate(
      programId,
      { $pull: { programGoals: { _id: goalId } } },
      { new: true },
    );

    if (!updatedProgram) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Goal deleted successfully",
      programId,
      goalId,
      program: updatedProgram,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getChildSessionStats = async (req, res) => {
  try {
    const { childId } = req.params;
    const therapistId = req.user._id || req.user.id;

    const schedules = await Scheduling.find({ therapistId, childId });

    let nextSession = null;
    let nextSessionDateTime = null;

    let completedCount = 0;
    let totalFinishedCount = 0;

    const now = new Date();

    schedules.forEach((schedule) => {
      (schedule.appointments || []).forEach((appt) => {
        const apptDate = new Date(appt.date?.$date || appt.date);

        const fullApptDateTime = new Date(apptDate);
        if (appt.startTime) {
          const [hours, minutes] = appt.startTime.split(":").map(Number);
          if (!isNaN(hours) && !isNaN(minutes)) {
            fullApptDateTime.setHours(hours, minutes, 0, 0);
          }
        }

        if (fullApptDateTime >= now) {
          if (!nextSessionDateTime || fullApptDateTime < nextSessionDateTime) {
            nextSessionDateTime = fullApptDateTime;
            nextSession = {
              date: appt.date,
              startTime: appt.startTime,
              endTime: appt.endTime,
            };
          }
        }

        const status = appt.attendance_status;

        if (status === "Complete") {
          completedCount++;
          totalFinishedCount++;
        } else if (status === "Absent") {
          totalFinishedCount++;
        } else if ((status === "Pending" || !status) && fullApptDateTime <= now) {
          totalFinishedCount++;
        }
      });
    });

    const attendancePercentage = totalFinishedCount > 0
      ? Math.round((completedCount / totalFinishedCount) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        nextSession,
        attendancePercentage,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFeedbackManagementData = async (req, res) => {
  try {
    const rawTherapistId = req.user._id || req.user.id;
    const therapistId = new mongoose.Types.ObjectId(rawTherapistId);
    const { childId } = req.params;
    const { monthRange } = req.query;

    const monthMap = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };

    let targetMonthNum = null;
    if (monthRange && monthRange !== "All Months") {
      const firstMonthName = monthRange.split("-")[0].trim().toLowerCase();
      targetMonthNum = monthMap[firstMonthName] || null;
    }

    const currentYear = new Date().getFullYear();

    const query = {
      therapistId,
      year: currentYear,
    };

    if (childId) {
      query.childId = new mongoose.Types.ObjectId(childId);
    }
    if (targetMonthNum) {
      query.month = targetMonthNum;
    }

    const schedules = await Scheduling.find(query)
      .populate("childId", "fullName email phone")
      .lean();

    const feedbacks = await Feedback.find({ therapistId }).lean();
    const feedbackMap = {};
    feedbacks.forEach((f) => {
      if (f.appointmentId) {
        feedbackMap[f.appointmentId.toString()] = f;
      }
    });

    const assignedChildIds = schedules.map((s) => s.childId?._id).filter(Boolean);
    const programs = await Program.find({
      userId: { $in: assignedChildIds },
      therapistId,
    }).lean();

    const programMap = {};
    programs.forEach((p) => {
      programMap[p.userId.toString()] = p.programName;
    });

    const childrenMap = {};
    let totalSessions = 0;
    let totalFeedbackDone = 0;

    schedules.forEach((schedule) => {
      const child = schedule.childId;
      if (!child) return;

      const childIdStr = child._id.toString();

      if (!childrenMap[childIdStr]) {
        childrenMap[childIdStr] = {
          id: childIdStr,
          name: child.fullName || "N/A",
          email: child.email || "N/A",
          phone: child.phone || "N/A",
          sessions: [],
        };
      }

      const appointments = schedule.appointments || [];

      appointments.forEach((appt) => {
        const apptIdStr = appt._id.toString();
        const dateObj = new Date(appt.date?.$date || appt.date);
        const formattedDate = dateObj
          .toLocaleString("en-US", { month: "short", day: "2-digit" })
          .toUpperCase();

        const existingFeedback = feedbackMap[apptIdStr];
        const isDone = !!existingFeedback;

        totalSessions++;
        if (isDone) totalFeedbackDone++;

        const resolvedCategory = programMap[childIdStr] || appt.category || "GENERAL";

        childrenMap[childIdStr].sessions.push({
          id: apptIdStr,
          name: child.fullName || "N/A",
          time: appt.startTime || "",
          endTime: appt.endTime || "",
          rawDate: appt.date,
          date: formattedDate,
          attendanceStatus: appt.attendance_status || "Pending",
          category: resolvedCategory,
          isDone,
          feedbackDetails: isDone
            ? {
              id: existingFeedback._id,
              notes: existingFeedback.notes,
              rating: existingFeedback.rating,
              category: existingFeedback.category,
              mood: existingFeedback.mood,
              isVisibleToParent: existingFeedback.isVisibleToParent,
            }
            : null,
        });
      });
    });

    const resultData = Object.values(childrenMap).map((childData) => {
      childData.sessions.sort((a, b) => {
        const dateA = new Date(a.rawDate?.$date || a.rawDate);
        const dateB = new Date(b.rawDate?.$date || b.rawDate);

        if (a.time) {
          const [hA, mA] = a.time.split(":").map(Number);
          dateA.setHours(hA || 0, mA || 0, 0, 0);
        }
        if (b.time) {
          const [hB, mB] = b.time.split(":").map(Number);
          dateB.setHours(hB || 0, mB || 0, 0, 0);
        }

        return dateA - dateB;
      });
      return childData;
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalChildren: resultData.length,
        totalSessions,
        totalFeedbackDone,
      },
      data: resultData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// exports.getFeedbackManagementData = async (req, res) => {
//   try {
//     const rawTherapistId = req.user._id || req.user.id;
//     const therapistId = new mongoose.Types.ObjectId(rawTherapistId);
//     const { childId } = req.params;
//     const { monthRange } = req.query;

//     const monthMap = {
//       january: 1,
//       february: 2,
//       march: 3,
//       april: 4,
//       may: 5,
//       june: 6,
//       july: 7,
//       august: 8,
//       september: 9,
//       october: 10,
//       november: 11,
//       december: 12,
//     };

//     let targetMonthNum = null;
//     if (monthRange && monthRange !== "All Months") {
//       const firstMonthName = monthRange.split("-")[0].trim().toLowerCase();
//       targetMonthNum = monthMap[firstMonthName] || null;
//     }

//     const currentYear = new Date().getFullYear();

//     const query = {
//       therapistId,
//       year: currentYear,
//     };

//     if (childId) {
//       query.childId = new mongoose.Types.ObjectId(childId);
//     }
//     if (targetMonthNum) {
//       query.month = targetMonthNum;
//     }

//     const schedules = await Scheduling.find(query)
//       .populate("childId", "fullName email phone")
//       .lean();

//     const feedbacks = await Feedback.find({ therapistId }).lean();
//     const feedbackMap = {};
//     feedbacks.forEach((f) => {
//       if (f.appointmentId) {
//         feedbackMap[f.appointmentId.toString()] = f;
//       }
//     });

//     const assignedChildIds = schedules.map((s) => s.childId?._id).filter(Boolean);
//     const programs = await Program.find({
//       userId: { $in: assignedChildIds },
//       therapistId,
//     }).lean();

//     const programMap = {};
//     programs.forEach((p) => {
//       programMap[p.userId.toString()] = p.programName;
//     });

//     const childrenMap = {};
//     let totalSessions = 0;
//     let totalFeedbackDone = 0;

//     schedules.forEach((schedule) => {
//       const child = schedule.childId;
//       if (!child) return;

//       const childIdStr = child._id.toString();

//       if (!childrenMap[childIdStr]) {
//         childrenMap[childIdStr] = {
//           id: childIdStr,
//           name: child.fullName || "N/A",
//           email: child.email || "N/A",
//           phone: child.phone || "N/A",
//           sessions: [],
//         };
//       }

//       const appointments = schedule.appointments || [];

//       appointments.forEach((appt) => {
//         const apptIdStr = appt._id.toString();
//         const dateObj = new Date(appt.date);
//         const formattedDate = dateObj
//           .toLocaleString("en-US", { month: "short", day: "2-digit" })
//           .toUpperCase();

//         const existingFeedback = feedbackMap[apptIdStr];
//         const isDone = !!existingFeedback;

//         totalSessions++;
//         if (isDone) totalFeedbackDone++;

//         const resolvedCategory = programMap[childIdStr] || appt.category || "GENERAL";

//         childrenMap[childIdStr].sessions.push({
//           id: apptIdStr,
//           name: child.fullName || "N/A",
//           time: appt.startTime || "",
//           endTime: appt.endTime || "",
//           rawDate: appt.date,
//           date: formattedDate,
//           attendanceStatus: appt.attendance_status || "Pending",
//           category: resolvedCategory,
//           isDone,
//           feedbackDetails: isDone
//             ? {
//               id: existingFeedback._id,
//               notes: existingFeedback.notes,
//               rating: existingFeedback.rating,
//               category: existingFeedback.category,
//               mood: existingFeedback.mood,
//               isVisibleToParent: existingFeedback.isVisibleToParent,
//             }
//             : null,
//         });
//       });
//     });

//     return res.status(200).json({
//       success: true,
//       stats: {
//         totalChildren: Object.keys(childrenMap).length,
//         totalSessions,
//         totalFeedbackDone,
//       },
//       data: Object.values(childrenMap),
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

exports.createFeedback = async (req, res) => {
  try {
    const therapistId = req.user._id || req.user.id;
    const {
      childId,
      appointmentId,
      category,
      notes,
      mood,
      isVisibleToParent,
      rating,
    } = req.body;

    const feedback = await Feedback.create({
      therapistId,
      childId,
      appointmentId,
      category,
      notes,
      mood: mood || "happy", // Default matching MOOD_OPTIONS id
      isVisibleToParent: isVisibleToParent !== undefined ? isVisibleToParent : true,
      rating: rating || 5,
    });

    return res.status(201).json({
      success: true,
      message: "Feedback created successfully",
      data: feedback,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const therapistId = req.user._id || req.user.id;
    const { childId, year, month, filter } = req.query;

    const query = { therapistId };
    const isTodayFilter = filter === "true" || filter === true;

    if (!isTodayFilter && childId) {
      query.childId = childId;
    }
    if (year) query.year = Number(year);
    if (month) query.month = Number(month);

    const records = await Scheduling.find(query)
      .populate("childId", "name parentName fullName")
      .lean();

    const sortedRecords = records.map((doc) => {
      if (Array.isArray(doc.appointments)) {
        doc.appointments.sort((a, b) => {
          const dateA = new Date(a.date?.$date || a.date);
          const dateB = new Date(b.date?.$date || b.date);

          // Parse startTime ("HH:mm") into hours and minutes
          if (a.startTime) {
            const [hA, mA] = a.startTime.split(":").map(Number);
            dateA.setHours(hA || 0, mA || 0, 0, 0);
          }
          if (b.startTime) {
            const [hB, mB] = b.startTime.split(":").map(Number);
            dateB.setHours(hB || 0, mB || 0, 0, 0);
          }

          return dateA - dateB;
        });
      }
      return doc;
    });

    return res.status(200).json({ success: true, data: sortedRecords });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAttendanceStatus = async (req, res) => {
  try {
    const { attendanceId, appointmentId, status } = req.body;

    console.log(attendanceId, appointmentId, status);
    const dbStatus = status === "Present" ? "Complete" : status;

    const updatedDoc = await Scheduling.findOneAndUpdate(
      { _id: attendanceId, "appointments._id": appointmentId },
      { $set: { "appointments.$.attendance_status": dbStatus } },
      { returnDocument: "after" },
    );

    return res.status(200).json({
      success: true,
      message: "Attendance status updated",
      data: updatedDoc,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLeaveRequest = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, role } = req.body;
    const applicantId = req.user?._id || req.user?.id || req.user?.userId;

    if (!applicantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in token payload.",
      });
    }

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: leaveType, startDate, endDate, reason",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    const startWithoutTime = new Date(start);
    startWithoutTime.setHours(0, 0, 0, 0);

    if (startWithoutTime < today) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be in the past.",
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be earlier than start date.",
      });
    }

    const userRole = role || req.user.role;
    if (!["Child", "Therapist"].includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified. Must be Child or Therapist.",
      });
    }

    const leaveRequest = await LeaveRequest.create({
      applicantId,
      role: userRole,
      leaveType,
      startDate: start,
      endDate: end,
      reason,
    });

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: leaveRequest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server Error while submitting leave request",
    });
  }
};

exports.getLeaveRequests = async (req, res) => {
  try {
    const applicantId = req.user._id || req.user.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const skip = (page - 1) * limit;

    const totalRequests = await LeaveRequest.countDocuments({ applicantId });

    const requests = await LeaveRequest.find({ applicantId })
      .populate("approved_by", "name fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        total: totalRequests,
        page,
        limit,
        totalPages: Math.ceil(totalRequests / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server Error fetching leave requests",
    });
  }
};

exports.getVideosByChild = async (req, res) => {
  try {
    const { childId } = req.params;

    const therapistId = req.user?._id || req.user?.id;

    if (!therapistId) {
      return res.status(401).json({
        success: false,
        message: "Therapist authentication is required.",
      });
    }

    const page = Math.max(
      parseInt(req.query.page) || 1,
      1,
    );

    const limit = Math.min(
      parseInt(req.query.limit) || 2,
      20,
    );

    const skip = (page - 1) * limit;

    const filter = {
      childId,
      therapistId,
    };

    const [videos, totalVideos] = await Promise.all([
      WeeklyVideo.find(filter)
        .populate("childId", "name fullName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      WeeklyVideo.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(
      totalVideos / limit,
    );

    return res.status(200).json({
      success: true,
      data: videos,
      pagination: {
        page,
        limit,
        totalVideos,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Get videos error:", error);

    return res.status(500).json({
      success: false,
      message: error.message
        || "Error fetching videos",
    });
  }
};

exports.createWeeklyVideo = async (req, res) => {
  try {
    const {
      childId,
      tag,
      videoUrl,
      duration,
      title,
      cloudinaryPublicId,
      cloudinaryResourceType,
      videoFormat,
      width,
      height,
      fileSize,
      durationSeconds,
    } = req.body;

    const therapistId = req.user?._id || req.user?.id;
    if (!therapistId) {
      return res.status(401).json({
        success: false,
        message: "Therapist authentication is required.",
      });
    }

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "childId is required.",
      });
    }

    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        message: "videoUrl is required.",
      });
    }

    const video = await WeeklyVideo.create({
      therapistId,
      childId,
      title: title || "Live Session",
      tag: tag || "Live Session",
      videoUrl,
      cloudinaryPublicId: cloudinaryPublicId || null,

      cloudinaryResourceType: cloudinaryResourceType || "video",

      videoFormat: videoFormat || null,

      width: width !== undefined
        ? Number(width)
        : null,

      height: height !== undefined
        ? Number(height)
        : null,

      fileSize: fileSize !== undefined
        ? Number(fileSize)
        : 0,

      duration: duration || "00:00",

      durationSeconds: durationSeconds !== undefined
        ? Number(durationSeconds)
        : 0,
    });

    const populatedVideo = await WeeklyVideo.findById(
      video._id,
    ).populate(
      "childId",
      "name fullName",
    );

    return res.status(201).json({
      success: true,
      message: "Weekly video saved successfully.",
      data: populatedVideo,
    });
  } catch (error) {
    console.error(
      "Create weekly video error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message
        || "Error saving weekly video.",
    });
  }
};

exports.deleteWeeklyVideo = async (req, res) => {
  try {
    const { id } = req.params;
    await WeeklyVideo.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error deleting video",
    });
  }
};
