const mongoose = require("mongoose");
const TherapistAssignment = require("../models/TherapistAssignment");
const User = require("../models/User");
const Program = require("../models/Program");
const Scheduling = require("../models/Scheduling");
const Feedback = require("../models/Feedback");
const LeaveRequest = require("../models/LeaveRequest");
const WeeklyVideo = require("../models/Video");
const cloudinary = require("../config/cloudinary");
const QuarterlyReport = require("../models/QuarterlyReport");
const { sendNotifications } = require("../utils/notificationService");
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


exports.getDashboardStats = async (req, res) => {
  try {
    const rawTherapistId = req.query.filter || req.user?._id || req.user?.id;

    if (!rawTherapistId || !mongoose.Types.ObjectId.isValid(rawTherapistId)) {
      return res.status(400).json({
        success: false,
        message: "Valid therapist ID is required.",
      });
    }

    const therapistId = new mongoose.Types.ObjectId(
      rawTherapistId,
    );

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const assignment = await TherapistAssignment.findOne({
      therapistId,
    }).lean();

    const assignedChildren = assignment?.childIds || [];

    const activeAssignedChildren = await User.find({
      _id: { $in: assignedChildren },
      isActive: true,
    })
      .select("_id")
      .lean();

    const assignedChildIds = new Set(
      activeAssignedChildren.map((child) => String(child._id)),
    );

    const schedules = await Scheduling.find({
      therapistId,
      month: currentMonth,
      year: currentYear,
    })
      .populate(
        "appointments.children.childId",
        "fullName name profileImage",
      )
      .lean();

    let todaySessions = 0;
    let completedSessions = 0;
    let attendanceSessions = 0;
    let totalSessions = 0;
    let nextSession = null;
    let closestTime = Infinity;

    const getSessionDateTime = (date, time) => {
      if (!date) {
        return null;
      }

      const value = new Date(date);

      if (Number.isNaN(value.getTime())) {
        return null;
      }

      if (time) {
        const [hours, minutes] = time
          .split(":")
          .map(Number);

        value.setHours(
          hours || 0,
          minutes || 0,
          0,
          0,
        );
      }

      return value;
    };

    schedules.forEach((schedule) => {
      (schedule.appointments || []).forEach(
        (appointment) => {
          const appointmentChildren = appointment.children || [];

          const children = appointmentChildren.filter(
            (child) => {
              const childId = child.childId?._id
                || child.childId;

              return assignedChildIds.has(
                String(childId),
              );
            },
          );

          if (!children.length) {
            return;
          }

          const startDateTime = getSessionDateTime(
            appointment.date,
            appointment.startTime,
          );

          const endDateTime = getSessionDateTime(
            appointment.date,
            appointment.endTime,
          );

          if (!startDateTime) {
            return;
          }

          totalSessions++;

          const isToday = startDateTime.getFullYear() === now.getFullYear()
            && startDateTime.getMonth() === now.getMonth() && startDateTime.getDate() === now.getDate();

          if (isToday) {
            todaySessions++;
          }

          if (startDateTime.getTime() >= now.getTime()) {
            const difference = startDateTime.getTime()
              - now.getTime();

            if (difference < closestTime) {
              closestTime = difference;

              const child = children[0];

              nextSession = {
                appointmentId: String(appointment._id),
                childId: String(child.childId?._id || child.childId),
                childName: child.childId?.fullName
                  || child.childId?.name
                  || "Assigned Child",
                childImage: child.childId?.profileImage
                  || "",
                date: appointment.date,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
              };
            }
          }

          if (endDateTime && endDateTime.getTime() <= now.getTime()) {
            children.forEach((child) => {
              attendanceSessions++;

              if (child.attendance_status === "Complete") {
                completedSessions++;
              }
            });
          }
        },
      );
    });

    const overallAttendance = attendanceSessions > 0
      ? Math.round(
        (
          completedSessions
          / attendanceSessions
        ) * 100,
      )
      : 0;

    const startOfMonth = new Date(
      currentYear,
      currentMonth - 1,
      1,
    );

    const startOfNextMonth = new Date(
      currentYear,
      currentMonth,
      1,
    );

    const totalSubmittedFeedback = await Feedback.countDocuments({
      therapistId,
      createdAt: {
        $gte: startOfMonth,
        $lt: startOfNextMonth,
      },
      notes: {
        $nin: [null, ""],
        $regex: /\S/,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        assignedChildren: activeAssignedChildren.length,
        todaySessions,
        monthlyFeedback: `${totalSubmittedFeedback}/${totalSessions}`,
        overallAttendance: `${overallAttendance}%`,
        nextSession,
      },
    });
  } catch (error) {
    console.error(
      "getDashboardStats error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message,
    });
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
      isActive: true,
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

exports.getChildProgramsSpeciality = async (req, res) => {
  try {
    const therapistId = req.query.therapistId
      || req.user?._id
      || req.user?.id;

    const { childId } = req.params;

    if (
      therapistId
      && !mongoose.Types.ObjectId.isValid(therapistId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid therapist ID.",
      });
    }

    if (
      childId
      && !mongoose.Types.ObjectId.isValid(childId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid child ID.",
      });
    }

    const matchQuery = {};

    if (therapistId) {
      matchQuery.therapistId = new mongoose.Types.ObjectId(therapistId);
    }

    if (childId) {
      matchQuery.childIds = new mongoose.Types.ObjectId(childId);
    }

    const data = await TherapistAssignment.aggregate([
      { $match: matchQuery },

      // Active therapist
      {
        $lookup: {
          from: "users",
          localField: "therapistId",
          foreignField: "_id",
          as: "therapist",
        },
      },
      { $unwind: "$therapist" },
      {
        $match: {
          "therapist.role": "Therapist",
          "therapist.isActive": true,
        },
      },

      // One row per assigned child
      { $unwind: "$childIds" },

      ...(childId
        ? [
          {
            $match: {
              childIds: new mongoose.Types.ObjectId(childId),
            },
          },
        ]
        : []),

      // Get active child
      {
        $lookup: {
          from: "users",
          localField: "childIds",
          foreignField: "_id",
          as: "child",
        },
      },
      { $unwind: "$child" },
      {
        $match: {
          "child.role": "Child",
          "child.isActive": true,
        },
      },

      // Get programs for this child and therapist
      {
        $lookup: {
          from: "programs",
          let: {
            childId: "$child._id",
            therapistId: "$therapist._id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$childId"] },
                    { $eq: ["$therapistId", "$$therapistId"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            {
              $project: {
                programName: 1,
                description: 1,
                therapistTitle: 1,
                therapistDescription: 1,
                programGoals: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
          as: "programs",
        },
      },

      // Group duplicate child assignments
      {
        $group: {
          _id: {
            therapistId: "$therapist._id",
            childId: "$child._id",
          },
          therapist: {
            $first: {
              _id: "$therapist._id",
              fullName: "$therapist.fullName",
              email: "$therapist.email",
              profileImage: "$therapist.profileImage",
              isActive: "$therapist.isActive",
            },
          },
          child: {
            $first: {
              _id: "$child._id",
              fullName: "$child.fullName",
              age: "$child.age",
              profileImage: "$child.profileImage",
              isActive: "$child.isActive",
            },
          },
          programs: { $first: "$programs" },
        },
      },

      // Group all children under therapist
      {
        $group: {
          _id: "$_id.therapistId",
          therapist: { $first: "$therapist" },
          children: {
            $push: {
              child: "$child",
              programs: "$programs",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          therapist: 1,
          children: 1,
          totalChildren: { $size: "$children" },
        },
      },
      { $sort: { "therapist.fullName": 1 } },
    ]);

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getChildPrograms error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch child programs.",
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
    const therapistId = req.query.therapistId
      || req.user?._id
      || req.user?.id;

    if (!therapistId || !childId) {
      return res.status(400).json({
        success: false,
        message: "Therapist ID and child ID are required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(therapistId)
      || !mongoose.Types.ObjectId.isValid(childId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid therapist ID or child ID",
      });
    }

    const schedules = await Scheduling.find({
      therapistId,
      "appointments.children.childId": childId,
    }).lean();

    const now = new Date();

    let nextSession = null;
    let nextSessionDateTime = null;
    let completedCount = 0;
    let totalFinishedCount = 0;

    schedules.forEach((schedule) => {
      (schedule.appointments || []).forEach((appointment) => {
        const childEntry = (appointment.children || []).find(
          (entry) => String(entry.childId) === String(childId),
        );

        if (!childEntry) {
          return;
        }

        const appointmentDate = new Date(
          appointment.date,
        );

        if (
          Number.isNaN(
            appointmentDate.getTime(),
          )
        ) {
          return;
        }

        const startDateTime = new Date(
          appointmentDate,
        );

        if (appointment.startTime) {
          const [hours, minutes] = appointment.startTime
            .split(":")
            .map(Number);

          startDateTime.setHours(
            hours || 0,
            minutes || 0,
            0,
            0,
          );
        }

        const endDateTime = new Date(
          appointmentDate,
        );

        if (appointment.endTime) {
          const [hours, minutes] = appointment.endTime
            .split(":")
            .map(Number);

          endDateTime.setHours(
            hours || 0,
            minutes || 0,
            0,
            0,
          );
        } else {
          endDateTime.setTime(
            startDateTime.getTime(),
          );
        }

        if (startDateTime >= now) {
          if (
            !nextSessionDateTime
            || startDateTime < nextSessionDateTime
          ) {
            nextSessionDateTime = startDateTime;

            nextSession = {
              appointmentId: String(
                appointment._id,
              ),
              date: appointment.date,
              startTime: appointment.startTime || "",
              endTime: appointment.endTime || "",
              attendanceStatus: childEntry.attendance_status
                || "Pending",
            };
          }
        }

        if (endDateTime <= now) {
          totalFinishedCount++;

          if (
            childEntry.attendance_status
              === "Complete"
          ) {
            completedCount++;
          }
        }
      });
    });

    const attendancePercentage = totalFinishedCount > 0
      ? Math.round(
        (
          completedCount
          / totalFinishedCount
        ) * 100,
      )
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        nextSession,
        attendancePercentage,
        completedSessions: completedCount,
        totalFinishedSessions: totalFinishedCount,
      },
    });
  } catch (error) {
    console.error(
      "getChildSessionStats error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getFeedbackManagementData = async (req, res) => {
  try {
    const rawTherapistId = req.user?._id || req.user?.id;
    const { childId } = req.params;
    const { monthRange } = req.query;

    if (
      !rawTherapistId
      || !mongoose.Types.ObjectId.isValid(rawTherapistId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid therapist ID is required",
      });
    }

    const therapistId = new mongoose.Types.ObjectId(
      rawTherapistId,
    );

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

    let targetMonths = [];

    if (monthRange && monthRange !== "All Months") {
      const [startMonthName, endMonthName] = monthRange
        .split("-")
        .map((item) => item.trim().toLowerCase());

      const startMonth = monthMap[startMonthName];
      const endMonth = monthMap[startMonthName];

      if (startMonth && endMonth) {
        for (let month = startMonth; month <= endMonth; month++) {
          targetMonths.push(month);
        }
      } else if (startMonth) {
        targetMonths.push(startMonth);
      }
    }
    const currentYear = new Date().getFullYear();

    const scheduleQuery = {
      therapistId,
      year: currentYear,
    };

    if (targetMonths.length) {
      scheduleQuery.month = {
        $in: targetMonths,
      };
    }

    const schedules = await Scheduling.find(
      scheduleQuery,
    )
      .populate(
        "appointments.children.childId",
        "fullName name email phone fatherName parentName profileImage",
      )
      .lean();

    const feedbackQuery = {
      therapistId,
    };

    if (
      childId
      && mongoose.Types.ObjectId.isValid(
        childId,
      )
    ) {
      feedbackQuery.childId = new mongoose.Types.ObjectId(
        childId,
      );
    }

    const feedbacks = await Feedback.find(
      feedbackQuery,
    ).lean();

    const feedbackMap = new Map();

    feedbacks.forEach((feedback) => {
      if (!feedback.appointmentId) {
        return;
      }

      const key = `${
        String(
          feedback.appointmentId,
        )
      }-${
        String(
          feedback.childId,
        )
      }`;

      feedbackMap.set(
        key,
        feedback,
      );
    });

    const allChildIds = new Set();

    schedules.forEach((schedule) => {
      (
        schedule.appointments || []
      ).forEach((appointment) => {
        (
          appointment.children || []
        ).forEach((childEntry) => {
          const id = childEntry.childId?._id
            || childEntry.childId;

          if (id) {
            allChildIds.add(
              String(id),
            );
          }
        });
      });
    });

    const programs = await Program.find({
      userId: {
        $in: Array.from(
          allChildIds,
        ),
      },
      therapistId,
    }).lean();

    const programMap = new Map();

    programs.forEach((program) => {
      programMap.set(
        String(program.userId),
        program.programName,
      );
    });

    const childrenMap = new Map();

    let totalSessions = 0;
    let totalFeedbackDone = 0;

    schedules.forEach((schedule) => {
      (
        schedule.appointments || []
      ).forEach((appointment) => {
        const appointmentId = String(
          appointment._id,
        );

        (
          appointment.children || []
        ).forEach((childEntry) => {
          const child = childEntry.childId;

          if (!child) {
            return;
          }

          const currentChildId = String(
            child._id || child,
          );

          if (
            childId
            && currentChildId
              !== String(childId)
          ) {
            return;
          }

          if (
            !childrenMap.has(
              currentChildId,
            )
          ) {
            childrenMap.set(
              currentChildId,
              {
                id: currentChildId,
                name: child.fullName
                  || child.name
                  || "N/A",
                email: child.email
                  || "N/A",
                phone: child.phone
                  || "N/A",
                fatherName: child.fatherName
                  || child.parentName
                  || "",
                profileImage: child.profileImage
                  || "",
                sessions: [],
              },
            );
          }

          const feedbackKey = `${appointmentId}-${currentChildId}`;

          const feedback = feedbackMap.get(
            feedbackKey,
          ) || null;

          const isDone = typeof feedback?.notes
              === "string"
            && feedback.notes
                .trim()
                .length > 0;

          const dateObj = new Date(
            appointment.date,
          );

          const formattedDate = Number.isNaN(
              dateObj.getTime(),
            )
            ? ""
            : dateObj
              .toLocaleString(
                "en-US",
                {
                  month: "short",
                  day: "2-digit",
                },
              )
              .toUpperCase();

          const category = programMap.get(
            currentChildId,
          )
            || appointment.category
            || "GENERAL";

          totalSessions++;

          if (isDone) {
            totalFeedbackDone++;
          }

          childrenMap
            .get(currentChildId)
            .sessions.push({
              id: appointmentId,
              appointmentId,
              childId: currentChildId,
              name: child.fullName
                || child.name
                || "N/A",
              time: appointment.startTime
                || "",
              startTime: appointment.startTime
                || "",
              endTime: appointment.endTime
                || "",
              rawDate: appointment.date,
              date: formattedDate,
              attendanceStatus: childEntry
                .attendance_status
                || "Pending",
              category,
              isDone,
              feedbackDetails: isDone
                ? {
                  id: String(
                    feedback._id,
                  ),
                  notes: feedback.notes,
                  rating: feedback.rating
                    || 0,
                  category: feedback.category
                    || category,
                  mood: feedback.mood
                    || "",
                  isVisibleToParent: feedback
                    .isVisibleToParent
                    !== false,
                  replies: feedback.replies
                    || [],
                }
                : null,
            });
        });
      });
    });

    const data = Array.from(
      childrenMap.values(),
    );

    data.forEach((child) => {
      child.sessions.sort(
        (a, b) => {
          const dateA = new Date(
            a.rawDate,
          );

          const dateB = new Date(
            b.rawDate,
          );

          if (a.startTime) {
            const [
              hours,
              minutes,
            ] = a.startTime
              .split(":")
              .map(Number);

            dateA.setHours(
              hours || 0,
              minutes || 0,
              0,
              0,
            );
          }

          if (b.startTime) {
            const [
              hours,
              minutes,
            ] = b.startTime
              .split(":")
              .map(Number);

            dateB.setHours(
              hours || 0,
              minutes || 0,
              0,
              0,
            );
          }

          return (
            dateA.getTime()
            - dateB.getTime()
          );
        },
      );
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalChildren: data.length,
        totalSessions,
        totalFeedbackDone,
      },
      data,
    });
  } catch (error) {
    console.error(
      "getFeedbackManagementData error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createFeedback = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;

    const {
      childId,
      appointmentId,
      category,
      notes,
      mood,
      isVisibleToParent,
      rating,
    } = req.body;

    if (
      !therapistId
      || !childId
      || !appointmentId
    ) {
      return res.status(400).json({
        success: false,
        message: "Therapist ID, child ID and appointment ID are required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        childId,
      )
      || !mongoose.Types.ObjectId.isValid(
        appointmentId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid child or appointment ID",
      });
    }

    if (!notes?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Feedback notes are required",
      });
    }

    const schedule = await Scheduling.findOne({
      therapistId,
      appointments: {
        $elemMatch: {
          _id: appointmentId,
          "children.childId": childId,
        },
      },
    }).lean();

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found for this child",
      });
    }

    let feedback = await Feedback.findOne({
      therapistId,
      childId,
      appointmentId: String(appointmentId),
    });

    if (feedback) {
      const hasTherapistFeedback = typeof feedback.notes
          === "string"
        && feedback.notes
            .trim()
            .length > 0;

      if (hasTherapistFeedback) {
        return res.status(409).json({
          success: false,
          message: "Feedback already exists for this session",
        });
      }

      feedback.notes = notes.trim();

      feedback.category = category?.trim()
        || feedback.category
        || "GENERAL";

      feedback.mood = mood
        || feedback.mood
        || "Happy";

      feedback.rating = Number(rating)
        || feedback.rating
        || 5;

      feedback.isVisibleToParent = isVisibleToParent
          !== undefined
        ? isVisibleToParent
        : true;

      await feedback.save();

      return res.status(200).json({
        success: true,
        message: "Feedback added successfully",
        data: feedback,
      });
    }

    feedback = await Feedback.create({
      therapistId,
      childId,
      appointmentId: String(appointmentId),
      category: category?.trim()
        || "GENERAL",
      notes: notes.trim(),
      mood: mood || "Happy",
      rating: Number(rating)
        || 5,
      isVisibleToParent: isVisibleToParent
          !== undefined
        ? isVisibleToParent
        : true,
      replies: [],
    });

    return res.status(201).json({
      success: true,
      message: "Feedback created successfully",
      data: feedback,
    });
  } catch (error) {
    console.error(
      "createFeedback error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const APP_TIME_ZONE = "Asia/Karachi";

const formatAppDate = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
};

const appointmentDateKey = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
};

const validDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value;
};

const addCalendarDays = (dateKey, count) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);

  return date.toISOString().slice(0, 10);
};

const normalizeStatus = (value) => {
  if (value === "Complete" || value === "Present") {
    return "Present";
  }

  if (value === "Absent") return "Absent";

  return "Pending";
};

const emptySummary = () => ({
  total: 0,
  present: 0,
  absent: 0,
  pending: 0,
});

// exports.getAttendance = async (req, res) => {
//   try {
//     const therapistId = req.user?._id || req.user?.id;

//     const {
//       year,
//       month,
//       mode = "today",
//       date,
//       childId,
//     } = req.query;

//     if (!mongoose.isValidObjectId(therapistId)) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized therapist.",
//       });
//     }

//     const selectedMode = String(mode).toLowerCase();

//     if (
//       !["today", "tomorrow", "week", "month"].includes(
//         selectedMode
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid attendance mode.",
//       });
//     }

//     if (childId && !mongoose.isValidObjectId(childId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid child ID.",
//       });
//     }

//     // ==========================================
//     // 1. SELECT DATE
//     // ==========================================

//     const today = formatAppDate(new Date());

//     let selectedDate;

//     if (date !== undefined) {
//       selectedDate = String(date);

//       if (!validDateKey(selectedDate)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid date. Use YYYY-MM-DD.",
//         });
//       }
//     } else if (selectedMode === "tomorrow") {
//       selectedDate = addCalendarDays(today, 1);
//     } else {
//       selectedDate = today;
//     }

//     const selectedYear = Number(
//       selectedDate.slice(0, 4)
//     );

//     const selectedMonth = Number(
//       selectedDate.slice(5, 7)
//     );

//     // Optional validation for supplied year/month.
//     if (
//       (year !== undefined &&
//         (!Number.isInteger(Number(year)) ||
//           Number(year) < 1)) ||
//       (month !== undefined &&
//         (!Number.isInteger(Number(month)) ||
//           Number(month) < 1 ||
//           Number(month) > 12))
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid year or month.",
//       });
//     }

//     // ==========================================
//     // 2. GET THERAPIST ASSIGNMENT
//     // ==========================================

//     const assignment = await TherapistAssignment.findOne({
//       therapistId: new mongoose.Types.ObjectId(
//         therapistId
//       ),
//     }).lean();

//     const assignedChildIds = assignment?.childIds || [];

//     const assignedSet = new Set(
//       assignedChildIds.map(String)
//     );

//     if (childId && !assignedSet.has(String(childId))) {
//       return res.status(403).json({
//         success: false,
//         message: "Child is not assigned to this therapist.",
//       });
//     }

//     if (assignedChildIds.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No assigned children found.",
//         mode: selectedMode,
//         selectedDate,
//         count: 0,
//         summary: emptySummary(),
//         data: [],
//       });
//     }

//     // ==========================================
//     // 3. FETCH ASSIGNED CHILDREN
//     // ==========================================

//     const childQuery = {
//       _id: {
//         $in: assignedChildIds,
//       },
//       isActive: true,
//     };

//     if (childId) {
//       childQuery._id = new mongoose.Types.ObjectId(
//         childId
//       );
//     }

//     const children = await User.find(childQuery)
//       .select(
//         "_id fullName name profileImage fatherName parentName"
//       )
//       .lean();

//     if (children.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No active assigned children found.",
//         mode: selectedMode,
//         selectedDate,
//         count: 0,
//         summary: emptySummary(),
//         data: [],
//       });
//     }

//     const childMap = new Map(
//       children.map((child) => [
//         String(child._id),
//         child,
//       ])
//     );

//     // ==========================================
//     // 4. GET SELECTED DATE SCHEDULES
//     // ==========================================

//     const schedules = await Scheduling.find({
//       therapistId: new mongoose.Types.ObjectId(
//         therapistId
//       ),
//       year: selectedYear,
//       month: selectedMonth,
//     })
//       .select(
//         "_id therapistId year month appointments"
//       )
//       .lean();

//     // ==========================================
//     // 5. RETURN ONLY SCHEDULED CHILDREN
//     // ==========================================

//     const data = [];

//     for (const schedule of schedules) {
//       for (const appointment of (
//         schedule.appointments || []
//       )) {
//         const currentDate = appointmentDateKey(
//           appointment.date
//         );

//         // Skip appointments on other dates.
//         if (currentDate !== selectedDate) {
//           continue;
//         }

//         for (const childEntry of (
//           appointment.children || []
//         )) {
//           const currentChildId = String(
//             childEntry.childId?._id ||
//             childEntry.childId ||
//             ""
//           );

//           // Only assigned and active children.
//           const child = childMap.get(currentChildId);

//           if (!child) continue;

//           data.push({
//             attendanceId: String(schedule._id),

//             appointmentId: String(
//               appointment._id
//             ),

//             childAttendanceId: childEntry._id
//               ? String(childEntry._id)
//               : null,

//             childId: String(child._id),

//             childName:
//               child.fullName ||
//               child.name ||
//               "Unknown Child",

//             fatherName: child.fatherName || "",
//             parentName: child.parentName || "",
//             profileImage: child.profileImage || "",

//             date: selectedDate,

//             startTime:
//               appointment.startTime || "",

//             endTime:
//               appointment.endTime || "",

//             isScheduled: true,

//             attendanceStatus: normalizeStatus(
//               childEntry.attendance_status
//             ),
//           });
//         }
//       }
//     }

//     // ==========================================
//     // 6. SORT BY TIME
//     // ==========================================

//     data.sort((a, b) => {
//       const timeCompare = String(
//         a.startTime
//       ).localeCompare(String(b.startTime));

//       if (timeCompare !== 0) return timeCompare;

//       return a.childName.localeCompare(
//         b.childName
//       );
//     });

//     // ==========================================
//     // 7. SUMMARY
//     // ==========================================

//     const summary = {
//       total: data.length,

//       present: data.filter(
//         (item) =>
//           item.attendanceStatus === "Present"
//       ).length,

//       absent: data.filter(
//         (item) =>
//           item.attendanceStatus === "Absent"
//       ).length,

//       pending: data.filter(
//         (item) =>
//           item.attendanceStatus === "Pending"
//       ).length,
//     };

//     return res.status(200).json({
//       success: true,
//       message: "Attendance fetched successfully.",
//       mode: selectedMode,
//       selectedDate,
//       count: data.length,
//       summary,
//       data,
//     });
//   } catch (error) {
//     console.error("getAttendance error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch attendance.",
//       error: error.message,
//     });
//   }
// };




// exports.getAttendance = async (req, res) => {
//   try {
//     const therapistId = req.user?._id || req.user?.id;
//     const {
//       childId,
//       year,
//       month,
//       filter,
//     } = req.query;

//     if (!therapistId) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized",
//       });
//     }

//     const isTodayFilter = filter === "true"
//       || filter === true;

//     const now = new Date();

//     const query = {
//       therapistId,
//     };

//     if (isTodayFilter) {
//       query.year = now.getFullYear();
//       query.month = now.getMonth() + 1;
//     } else {
//       if (year) {
//         query.year = Number(year);
//       }

//       if (month) {
//         query.month = Number(month);
//       }
//     }

//     const schedules = await Scheduling.find(query)
//       .populate(
//         "appointments.children.childId",
//         "fullName name fatherName parentName profileImage",
//       )
//       .lean();

//     const data = [];

//     schedules.forEach((schedule) => {
//       (schedule.appointments || []).forEach((appointment) => {
//         const appointmentDate = new Date(
//           appointment.date,
//         );

//         if (
//           Number.isNaN(
//             appointmentDate.getTime(),
//           )
//         ) {
//           return;
//         }

//         if (isTodayFilter) {
//           const isToday = appointmentDate.getFullYear()
//               === now.getFullYear()
//             && appointmentDate.getMonth()
//               === now.getMonth()
//             && appointmentDate.getDate()
//               === now.getDate();

//           if (!isToday) {
//             return;
//           }
//         }

//         (appointment.children || []).forEach((childEntry) => {
//           const child = childEntry.childId;

//           if (!child) {
//             return;
//           }

//           const currentChildId = String(
//             child._id || child,
//           );

//           if (
//             childId
//             && currentChildId !== String(childId)
//           ) {
//             return;
//           }

//           data.push({
//             attendanceId: String(
//               schedule._id,
//             ),
//             appointmentId: String(
//               appointment._id,
//             ),
//             childAttendanceId: childEntry._id
//               ? String(childEntry._id)
//               : null,
//             childId: currentChildId,
//             childName: child.fullName
//               || child.name
//               || "Unknown Child",
//             fatherName: child.fatherName || "",
//             parentName: child.parentName || "",
//             profileImage: child.profileImage || "",
//             date: appointment.date,
//             startTime: appointment.startTime || "",
//             endTime: appointment.endTime || "",
//             attendanceStatus: childEntry.attendance_status
//               || "Pending",
//           });
//         });
//       });
//     });

//     data.sort((a, b) => {
//       const dateA = new Date(a.date);
//       const dateB = new Date(b.date);

//       if (a.startTime) {
//         const [hours, minutes] = a.startTime
//           .split(":")
//           .map(Number);

//         dateA.setHours(
//           hours || 0,
//           minutes || 0,
//           0,
//           0,
//         );
//       }

//       if (b.startTime) {
//         const [hours, minutes] = b.startTime
//           .split(":")
//           .map(Number);

//         dateB.setHours(
//           hours || 0,
//           minutes || 0,
//           0,
//           0,
//         );
//       }

//       return dateA.getTime()
//         - dateB.getTime();
//     });

//     return res.status(200).json({
//       success: true,
//       count: data.length,
//       data,
//     });
//   } catch (error) {
//     console.error(
//       "getAttendance error:",
//       error,
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

exports.getAttendance = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;

    const {
      year,
      month,
      mode = "today",
      date,
      childId,
      attendanceType = "child",
    } = req.query;

    if (!mongoose.isValidObjectId(therapistId)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized therapist.",
      });
    }

    // ==========================================
    // 1. VALIDATE ATTENDANCE TYPE
    // ==========================================

    const selectedAttendanceType = String(
      attendanceType
    ).toLowerCase();

    if (!["child", "therapist"].includes(selectedAttendanceType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance type. Use child or therapist.",
      });
    }

    const selectedMode = String(mode).toLowerCase();

    if (!["today", "tomorrow", "week", "month"].includes(selectedMode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance mode.",
      });
    }

    if (
      selectedAttendanceType === "therapist" &&
      childId
    ) {
      return res.status(400).json({
        success: false,
        message: "Child filter is not supported for therapist attendance.",
      });
    }

    if (childId && !mongoose.isValidObjectId(childId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid child ID.",
      });
    }

    // ==========================================
    // 2. SELECT DATE
    // ==========================================

    const today = formatAppDate(new Date());

    let selectedDate;

    if (date !== undefined) {
      selectedDate = String(date);

      if (!validDateKey(selectedDate)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date. Use YYYY-MM-DD.",
        });
      }
    } else if (selectedMode === "tomorrow") {
      selectedDate = addCalendarDays(today, 1);
    } else {
      selectedDate = today;
    }

    const selectedYear = Number(selectedDate.slice(0, 4));
    const selectedMonth = Number(selectedDate.slice(5, 7));

    if (
      (year !== undefined &&
        (!Number.isInteger(Number(year)) ||
          Number(year) < 1)) ||
      (month !== undefined &&
        (!Number.isInteger(Number(month)) ||
          Number(month) < 1 ||
          Number(month) > 12))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid year or month.",
      });
    }

    // ==========================================
    // 3. GET THERAPIST ASSIGNMENT
    // ==========================================

    const assignment = await TherapistAssignment.findOne({
      therapistId: new mongoose.Types.ObjectId(therapistId),
    }).lean();

    const assignedChildIds = assignment?.childIds || [];

    const assignedSet = new Set(
      assignedChildIds.map(String)
    );

    if (childId && !assignedSet.has(String(childId))) {
      return res.status(403).json({
        success: false,
        message: "Child is not assigned to this therapist.",
      });
    }

    if (assignedChildIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No assigned children found.",
        mode: selectedMode,
        attendanceType: selectedAttendanceType,
        selectedDate,
        count: 0,
        summary: emptySummary(),
        data: [],
      });
    }

    // ==========================================
    // 4. FETCH ASSIGNED CHILDREN
    // ==========================================

    const childQuery = {
      _id: {
        $in: assignedChildIds,
      },
      isActive: true,
    };

    if (childId) {
      childQuery._id = new mongoose.Types.ObjectId(childId);
    }

    const children = await User.find(childQuery)
      .select(
        "_id fullName name profileImage fatherName parentName"
      )
      .lean();

    if (children.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No active assigned children found.",
        mode: selectedMode,
        attendanceType: selectedAttendanceType,
        selectedDate,
        count: 0,
        summary: emptySummary(),
        data: [],
      });
    }

    const childMap = new Map(
      children.map((child) => [
        String(child._id),
        child,
      ])
    );

    // ==========================================
    // 5. GET SCHEDULES
    // ==========================================

    const schedules = await Scheduling.find({
      therapistId: new mongoose.Types.ObjectId(therapistId),
      year: selectedYear,
      month: selectedMonth,
    })
      .select("_id therapistId year month appointments")
      .lean();

    // ==========================================
    // 6. BUILD ATTENDANCE RESPONSE
    // ==========================================

    const data = [];

    for (const schedule of schedules) {
      for (const appointment of schedule.appointments || []) {
        const currentDate = appointmentDateKey(
          appointment.date
        );

        if (currentDate !== selectedDate) {
          continue;
        }

        const validChildren = [];

        for (const childEntry of appointment.children || []) {
          const currentChildId = String(
            childEntry.childId?._id ||
            childEntry.childId ||
            ""
          );

          const child = childMap.get(currentChildId);

          if (!child) continue;

          validChildren.push({
            childEntry,
            child,
          });
        }

        // Skip appointments without assigned active children.
        if (validChildren.length === 0) {
          continue;
        }

        // ==========================================
        // THERAPIST ATTENDANCE
        // One record per appointment.
        // ==========================================

        if (selectedAttendanceType === "therapist") {
          const therapistStatus = String(
            appointment.therapist_attendance || "pending"
          ).toLowerCase();

          const childNames = validChildren.map(
            ({ child }) =>
              child.fullName ||
              child.name ||
              "Unknown Child"
          );

          data.push({
            attendanceId: String(schedule._id),

            appointmentId: String(appointment._id),

            date: selectedDate,

            startTime: appointment.startTime || "",
            endTime: appointment.endTime || "",

            isScheduled: true,

            // Appointment-level attendance
            therapistAttendance: therapistStatus,

            therapistAttendanceMarkedAt:
              appointment.therapist_attendance_marked_at ||
              null,

            // Children belonging to this appointment
            childIds: validChildren.map(({ child }) =>
              String(child._id)
            ),

            childName: childNames.join(", "),

            // Not used for therapist attendance updates
            childId: null,
            profileImage: "",
          });

          continue;
        }

        // ==========================================
        // CHILD ATTENDANCE
        // One record per child.
        // ==========================================

        for (const { childEntry, child } of validChildren) {
          data.push({
            attendanceId: String(schedule._id),

            appointmentId: String(appointment._id),

            childAttendanceId: childEntry._id
              ? String(childEntry._id)
              : null,

            childId: String(child._id),

            childName:
              child.fullName ||
              child.name ||
              "Unknown Child",

            fatherName: child.fatherName || "",
            parentName: child.parentName || "",
            profileImage: child.profileImage || "",

            date: selectedDate,

            startTime: appointment.startTime || "",
            endTime: appointment.endTime || "",

            isScheduled: true,

            attendanceStatus: normalizeStatus(
              childEntry.attendance_status
            ),

            // Also return therapist attendance information.
            therapistAttendance: String(
              appointment.therapist_attendance || "pending"
            ).toLowerCase(),

            therapistAttendanceMarkedAt:
              appointment.therapist_attendance_marked_at ||
              null,
          });
        }
      }
    }

    // ==========================================
    // 7. SORT BY TIME
    // ==========================================

    data.sort((a, b) => {
      const timeCompare = String(a.startTime).localeCompare(
        String(b.startTime)
      );

      if (timeCompare !== 0) return timeCompare;

      return String(a.childName).localeCompare(
        String(b.childName)
      );
    });

    // ==========================================
    // 8. SUMMARY
    // ==========================================

    let summary;

    if (selectedAttendanceType === "therapist") {
      summary = {
        total: data.length,

        present: data.filter(
          (item) => item.therapistAttendance === "present"
        ).length,

        absent: data.filter(
          (item) => item.therapistAttendance === "absent"
        ).length,

        pending: data.filter(
          (item) => item.therapistAttendance === "pending"
        ).length,

        cancelled: data.filter(
          (item) => item.therapistAttendance === "cancel"
        ).length,

        postponed: data.filter(
          (item) => item.therapistAttendance === "postpond" || item.therapistAttendance === "postponed"
        ).length,
      };
    } else {
      summary = {
        total: data.length,

        present: data.filter(
          (item) => item.attendanceStatus === "Present"
        ).length,

        absent: data.filter(
          (item) => item.attendanceStatus === "Absent"
        ).length,

        pending: data.filter(
          (item) => item.attendanceStatus === "Pending"
        ).length,
      };
    }

    // ==========================================
    // 9. RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,
      message: "Attendance fetched successfully.",
      mode: selectedMode,
      attendanceType: selectedAttendanceType,
      selectedDate,
      count: data.length,
      summary,
      data,
    });

  } catch (error) {
    console.error("getAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance.",
      error: error.message,
    });
  }
};
exports.updateAttendanceStatus = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;

    const {
      attendanceId,
      appointmentId,
      childId,
      status,
    } = req.body;
    if (
      !attendanceId
      || !appointmentId
      || !childId
      || !status
    ) {
      return res.status(400).json({
        success: false,
        message: "attendanceId, appointmentId, childId and status are required",
      });
    }

    const dbStatus = status === "Present"
      ? "Complete"
      : status;

    if (
      ![
        "Complete",
        "Absent",
        "Pending",
      ].includes(dbStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    const updatedDoc = await Scheduling.findOneAndUpdate(
      {
        _id: attendanceId,
        therapistId,
      },
      {
        $set: {
          "appointments.$[appointment].children.$[child].attendance_status": dbStatus,
        },
      },
      {
        arrayFilters: [
          {
            "appointment._id": appointmentId,
          },
          {
            "child.childId": childId,
          },
        ],
        returnDocument: "after",
      },
    );

    if (!updatedDoc) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance status updated",
      data: updatedDoc,
    });
  } catch (error) {
    console.error(
      "updateAttendanceStatus error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.updateTherapistAttendance = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;
    const { attendanceId, appointmentId, status } = req.body;

    if (!attendanceId || !appointmentId || !status) {
      return res.status(400).json({
        success: false,
        message: "attendanceId, appointmentId and status are required",
      });
    }

    if (
      !mongoose.isValidObjectId(attendanceId)
      || !mongoose.isValidObjectId(appointmentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendanceId or appointmentId",
      });
    }

    const nextStatus = String(status).toLowerCase();

    if (!["present", "absent", "pending"].includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid therapist attendance status",
      });
    }

    const schedule = await Scheduling.findOne({
      _id: attendanceId,
      therapistId,
    })
      .select("appointments")
      .lean();

    const appointment = schedule?.appointments?.find(
      (a) => String(a._id) === String(appointmentId),
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const currentStatus = String(
      appointment.therapist_attendance || "pending",
    ).toLowerCase();

    if (["cancel", "postpond", "postponed"].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Attendance cannot be changed for a cancelled or postponed appointment.",
      });
    }

    if (appointmentDateKey(appointment.date) !== formatAppDate(new Date())) {
      return res.status(400).json({
        success: false,
        message: "Attendance can only be marked for today's sessions.",
      });
    }

    const updatedDoc = await Scheduling.findOneAndUpdate(
      {
        _id: attendanceId,
        therapistId,
        appointments: {
          $elemMatch: {
            _id: appointmentId,
            therapist_attendance: { $nin: ["cancel", "postpond", "postponed"] },
          },
        },
      },
      {
        $set: {
          "appointments.$.therapist_attendance": nextStatus,
          "appointments.$.therapist_attendance_marked_at":
            nextStatus === "pending" ? null : new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!updatedDoc) {
      return res.status(409).json({
        success: false,
        message: "Attendance could not be updated.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Therapist attendance updated",
      data: {
        attendanceId,
        appointmentId,
        therapistAttendance: nextStatus,
      },
    });
  } catch (error) {
    console.error("updateTherapistAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
    const adminUsers = await User.find({ role: "Admin" }).select("_id");
    const adminIds = adminUsers.map((admin) => String(admin._id));
    if (adminIds.length > 0) {
      await sendNotifications({
        title: "New Leave Request",
        message: `A new leave request has been submitted by a ${userRole}.\nLeave Type: ${leaveType}`,
        type: "Reminder",
        audience: "users",
        users: adminIds,
        createdBy: applicantId,
        sendPush: true,
      });
    }
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

    const search = (req.query.search || "").trim();

    const filter = {
      childId,
      therapistId,
    };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: escaped, $options: "i" };
    }

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
    const cleanTitle = typeof title === "string" ? title.trim() : "";

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: "Video title is required.",
      });
    }

    if (cleanTitle.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Title must be 100 characters or less.",
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
    await sendNotifications({
      title: "New Weekly Video Available",
      message: `Your therapist has uploaded a new video for you.\nVideo Title: ${cleanTitle}`,
      type: "Reminder",
      audience: "users",
      users: [String(childId)],
      createdBy: therapistId,
      sendPush: true,
    });
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

    const therapistId = req.user?._id || req.user?.id;

    if (!therapistId) {
      return res.status(401).json({
        success: false,
        message: "Therapist authentication is required.",
      });
    }

    const video = await WeeklyVideo.findOne({
      _id: id,
      therapistId,
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found.",
      });
    }
    const stillUsed = await WeeklyVideo.exists({
      videoUrl: video.videoUrl,
      _id: { $ne: video._id },
    });
    let cloudinaryDeleted = false;

    if (!stillUsed && video.cloudinaryPublicId) {
      try {
        const cloudinaryResult = await cloudinary.uploader.destroy(
          video.cloudinaryPublicId,
          {
            resource_type: video.cloudinaryResourceType || "video",
            type: "upload",
            invalidate: true,
          },
        );

        console.log("Cloudinary delete result:", cloudinaryResult);

        cloudinaryDeleted = cloudinaryResult.result === "ok";

        if (
          cloudinaryResult.result !== "ok" &&
          cloudinaryResult.result !== "not found"
        ) {
          console.warn("Cloudinary asset was not deleted:", cloudinaryResult);
        }
      } catch (cloudinaryError) {
        console.error(
          "Cloudinary delete error:",
          cloudinaryError,
        );

        return res.status(500).json({
          success: false,
          message: "Failed to delete video from Cloudinary.",
          error: cloudinaryError.message,
        });
      }
    }

    await WeeklyVideo.deleteOne({ _id: video._id });

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully.",
      data: {
        id: video._id,
        cloudinaryDeleted,
      },
    });
  } catch (error) {
    console.error(
      "Delete weekly video error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message
        || "Error deleting video.",
    });
  }
};

exports.createQuarterlyReport = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;
    
    if (!therapistId) {
      return res.status(401).json({
        success: false,
        message: "Therapist authentication required.",
      });
    }

    const {
      userId,
      year,
      quarter,
      programs,
      sentToParents,
      status,
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required.",
      });
    }

    if (!year) {
      return res.status(400).json({
        success: false,
        message: "year is required.",
      });
    }

    if (!quarter) {
      return res.status(400).json({
        success: false,
        message: "quarter is required.",
      });
    }

    if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quarter. Use Q1, Q2, Q3 or Q4.",
      });
    }

    if (!Array.isArray(programs)) {
      return res.status(400).json({
        success: false,
        message: "programs must be an array.",
      });
    }

    const cleanPrograms = programs.map((program) => ({
      programId: program.programId,
      programName: program.programName || "",
      goals: Array.isArray(program.goals)
        ? program.goals.map((goal) => ({
          goalId: goal.goalId || null,
          goalName: goal.goalName || "",
        }))
        : [],
      report: program.report || "",
    }));
    const existing = await QuarterlyReport.exists({
      therapistId, userId, year: Number(year), quarter,
    });
    const quarterlyReport = await QuarterlyReport.findOneAndUpdate(
      {
        therapistId,
        userId,
        year: Number(year),
        quarter,
      },
      {
        $set: {
          programs: cleanPrograms,
          sentToParents: typeof sentToParents === "boolean"
            ? sentToParents
            : true,
          status: status || "submitted",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    try {
      const [therapist, child, admins] = await Promise.all([
        User.findById(therapistId).select("fullName name").lean(),
        User.findById(userId).select("fullName name").lean(),
        User.find({ role: "Admin", isActive: { $ne: false } }).select("_id").lean(),
      ]);

      const therapistName = therapist?.fullName || therapist?.name || "A therapist";
      const childName = child?.fullName || child?.name || "a child";

      if (admins.length) {
        await sendNotifications({
          title: existing ? "Quarterly report updated" : "New quarterly report",
          message: `${therapistName} ${existing ? "updated" : "submitted"} the ${quarter} ${year} report for ${childName}.`,
          type: "General",
          audience: "users",
          users: admins.map((a) => a._id),
          createdBy: therapistId,
          sendPush: true,
        });
      }
    } catch (notifyErr) {
      console.error("Quarterly report notification failed:", notifyErr);
    }
    return res.status(200).json({
      success: true,
      message: "Quarterly report saved successfully.",
      data: quarterlyReport,
    });
  } catch (error) {
    console.error(
      "Create quarterly report error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save quarterly report.",
      error: error.message,
    });
  }
};

exports.getQuarterlyReport = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;

    if (!therapistId) {
      return res.status(401).json({
        success: false,
        message: "Therapist authentication required.",
      });
    }

    const {
      userId,
      year,
      quarter,
    } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required.",
      });
    }

    if (!year) {
      return res.status(400).json({
        success: false,
        message: "year is required.",
      });
    }

    if (!quarter) {
      return res.status(400).json({
        success: false,
        message: "quarter is required.",
      });
    }

    const report = await QuarterlyReport.findOne({
      therapistId,
      userId,
      year: Number(year),
      quarter,
    }).lean();

    if (!report) {
      return res.status(200).json({
        success: true,
        message: "No quarterly report found.",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Quarterly report fetched successfully.",
      data: report,
    });
  } catch (error) {
    console.error(
      "Get quarterly report error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch quarterly report.",
      error: error.message,
    });
  }
};

exports.getQuarterlyReportsByChild = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;

    if (!therapistId) {
      return res.status(401).json({
        success: false,
        message: "Therapist authentication required.",
      });
    }

    const { userId, year } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required.",
      });
    }

    const query = {
      therapistId,
      userId,
    };

    if (year) {
      query.year = Number(year);
    }

    const reports = await QuarterlyReport.find(query)
      .sort({
        year: -1,
        quarter: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error(
      "Get child quarterly reports error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch quarterly reports.",
      error: error.message,
    });
  }
};

exports.getFeedbackReplies = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;
    const { feedbackId } = req.params;

    if (!feedbackId) {
      return res.status(400).json({
        success: false,
        message: "Feedback ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid feedback ID",
      });
    }

    const feedback = await Feedback.findOne({
      _id: feedbackId,
      therapistId,
    })
      .populate(
        "replies.repliedBy",
        "fullName name profileImage role",
      )
      .populate(
        "childId",
        "fullName name profileImage",
      )
      .populate(
        "therapistId",
        "fullName name profileImage",
      )
      .lean();

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: feedback,
      replies: feedback.replies || [],
    });
  } catch (error) {
    console.error("getFeedbackReplies error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addTherapistFeedbackReply = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;

    const { feedbackId } = req.params;
    const { message } = req.body;

    if (!therapistId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        feedbackId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid feedback ID",
      });
    }

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required",
      });
    }

    const feedback = await Feedback.findOne({
      _id: feedbackId,
      therapistId,
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    feedback.replies.push({
      repliedBy: therapistId,
      repliedByRole: "Therapist",
      message: message.trim(),
    });

    await feedback.save();

    const updatedFeedback = await Feedback.findById(
      feedback._id,
    )
      .populate(
        "therapistId",
        "fullName profileImage role",
      )
      .populate(
        "childId",
        "fullName profileImage role",
      )
      .populate(
        "replies.repliedBy",
        "fullName profileImage role",
      )
      .lean();

    return res.status(200).json({
      success: true,
      message: "Reply added successfully",
      data: updatedFeedback,
      replies: updatedFeedback.replies || [],
    });
  } catch (error) {
    console.error(
      "addTherapistFeedbackReply error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to add reply",
      error: error.message,
    });
  }
};

exports.updateFeedbackVisibility = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;
    const { feedbackId } = req.params;
    const { isVisibleToParent } = req.body;

    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid feedback ID",
      });
    }

    if (typeof isVisibleToParent !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Visibility value is required",
      });
    }

    const feedback = await Feedback.findOneAndUpdate(
      {
        _id: feedbackId,
        therapistId,
      },
      {
        $set: {
          isVisibleToParent,
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: isVisibleToParent
        ? "Feedback enabled for parent and child"
        : "Feedback disabled for parent and child",
      data: feedback,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getTherapistAttendance = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;

    if (!mongoose.isValidObjectId(therapistId)) {
      return res.status(400).json({
        success: false,
        message: "Valid therapist ID is required.",
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const schedule = await Scheduling.findOne({
      therapistId: new mongoose.Types.ObjectId(therapistId),
      year,
      month,
    }).lean();

    const appointments = (schedule?.appointments || [])
      .filter((appointment) => {
        return !["cancel", "postponed"].includes(
          appointment.sessionType,
        );
      })
      .map((appointment) => {
        const date = new Date(appointment.date);
        const dateString = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");

        return {
          appointmentId: String(appointment._id),
          date: dateString,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          sessionStatus: appointment.session_status,
          therapistAttendance:
            appointment.therapist_attendance || "pending",
          markedAt:
            appointment.therapist_attendance_marked_at || null,
        };
      })
      .sort((a, b) => {
        const aTime = new Date(`${a.date}T${a.startTime}:00`);
        const bTime = new Date(`${b.date}T${b.startTime}:00`);
        return bTime - aTime;
      });

    const latestMarked = appointments.find(
      (appointment) => appointment.markedAt,
    );

    const upcoming = appointments
      .filter((appointment) => {
        const start = new Date(
          `${appointment.date}T${appointment.startTime}:00`,
        );
        const end = new Date(
          `${appointment.date}T${appointment.endTime}:00`,
        );

        return end >= now && start.getTime() <= now.getTime() + 5 * 60 * 1000;
      })
      .sort((a, b) => {
        return new Date(`${a.date}T${a.startTime}:00`)
          - new Date(`${b.date}T${b.startTime}:00`);
      })[0] || null;

    return res.status(200).json({
      success: true,
      data: {
        latestAttendance: latestMarked || {
          therapistAttendance: "pending",
          markedAt: null,
          appointmentId: null,
          date: null,
          startTime: null,
          endTime: null,
        },
        dueAppointment: upcoming,
      },
    });
  } catch (error) {
    console.error("getTherapistAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch therapist attendance.",
    });
  }
};

exports.markTherapistAttendance = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;
    const { appointmentId } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "present",
      "absent",
      "cancel",
      "postpond",
      "postponed",
    ];

    if (
      !mongoose.isValidObjectId(therapistId) ||
      !mongoose.isValidObjectId(appointmentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid therapist or appointment ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid therapist attendance status.",
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Find the schedule belonging to this authenticated therapist.
    const schedule = await Scheduling.findOne({
      therapistId: new mongoose.Types.ObjectId(therapistId),
      year,
      month,
      "appointments._id": new mongoose.Types.ObjectId(appointmentId),
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found for this therapist.",
      });
    }

    const appointment = schedule.appointments.id(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    // Do not permit attendance to be marked more than 5 minutes
    // before the appointment starts.
    const date = new Date(appointment.date);
    const dateString = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    const [hours, minutes] = appointment.startTime.split(":").map(Number);
    const startTime = new Date(
      `${dateString}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`,
    );

    if (now.getTime() < startTime.getTime() - 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: "You can mark attendance within 5 minutes of the session start.",
      });
    }

    appointment.therapist_attendance = status;
    appointment.therapist_attendance_marked_at = now;

    await schedule.save();

    return res.status(200).json({
      success: true,
      message: "Therapist attendance marked successfully.",
      data: {
        appointmentId: String(appointment._id),
        therapistAttendance: appointment.therapist_attendance,
        markedAt: appointment.therapist_attendance_marked_at,
        date: dateString,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      },
    });
  } catch (error) {
    console.error("markTherapistAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark therapist attendance.",
    });
  }
};

const getAssignedChildIds = async (therapistId) => {
  const rows = await TherapistAssignment.find({ therapistId })
    .select("childIds")
    .lean();
  return [...new Set(rows.flatMap((r) => (r.childIds || []).map(String)))];
};

exports.updateVideoTitle = async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ success: false, message: "Title is required." });
    if (title.length > 100) return res.status(400).json({ success: false, message: "Title is too long." });

    const video = await WeeklyVideo.findOneAndUpdate(
      { _id: req.params.id, therapistId: req.user.id },
      { title },
      { new: true }
    );
    if (!video) return res.status(404).json({ success: false, message: "Video not found." });

    await WeeklyVideo.updateMany(
      { videoUrl: video.videoUrl, therapistId: req.user.id },
      { title }
    );

    return res.json({ success: true, data: video });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.getShareStatus = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;

    const source = await WeeklyVideo.findOne({
      _id: req.params.id,
      therapistId,
    }).lean();
    if (!source) {
      return res.status(404).json({ success: false, message: "Video not found." });
    }

    const holders = await WeeklyVideo.find({
      videoUrl: source.videoUrl,
      therapistId,
    }).select("childId").lean();
    const holderIds = holders.map((h) => String(h.childId));
    const holderSet = new Set(holderIds);

    const assignedIds = await getAssignedChildIds(therapistId);
    const candidateIds = [...new Set([...assignedIds, ...holderIds])];

    const filter = { _id: { $in: candidateIds }, role: "Child", isActive: true };
    const search = String(req.query.search || "").trim();
    if (search) filter.fullName = { $regex: escapeRegex(search), $options: "i" };

    const children = await User.find(filter, { _id: 1, fullName: 1 })
      .sort({ fullName: 1 })
      .limit(50)
      .lean();

    const data = children.map((c) => ({
      _id: c._id,
      fullName: c.fullName,
      isShared: holderSet.has(String(c._id)),
    }));

    return res.json({ success: true, data, holderCount: holderIds.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.updateVideoSharing = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;
    const shareIds = Array.isArray(req.body.shareIds) ? req.body.shareIds.map(String) : [];
    const unshareIds = Array.isArray(req.body.unshareIds) ? req.body.unshareIds.map(String) : [];

    const source = await WeeklyVideo.findOne({
      _id: req.params.id,
      therapistId,
    }).lean();
    if (!source) {
      return res.status(404).json({ success: false, message: "Video not found." });
    }

    const holders = await WeeklyVideo.find({
      videoUrl: source.videoUrl,
      therapistId,
    }).select("childId").lean();
    const holderSet = new Set(holders.map((h) => String(h.childId)));

    const assigned = new Set(await getAssignedChildIds(therapistId));

    const toShare = [...new Set(shareIds)].filter(
      (id) => assigned.has(id) && !holderSet.has(id),
    );
    const toUnshare = [...new Set(unshareIds)].filter((id) => holderSet.has(id));

    if (!toShare.length && !toUnshare.length) {
      return res.status(400).json({ success: false, message: "No changes to save." });
    }

    const finalCount = holderSet.size + toShare.length - toUnshare.length;
    if (finalCount < 1) {
      return res.status(400).json({
        success: false,
        message: "At least one child must keep this video.",
      });
    }

    let removedCount = 0;

    if (toShare.length) {
      const { _id, createdAt, updatedAt, __v, sharedFrom, ...rest } = source;
      await WeeklyVideo.insertMany(
        toShare.map((childId) => ({ ...rest, childId })),
      );

      try {
        await sendNotifications({
          title: "New Weekly Video Available",
          message: `Your therapist has shared a video with you.\nVideo Title: ${source.title}`,
          type: "Reminder",
          audience: "users",
          users: toShare,
          createdBy: therapistId,
          sendPush: true,
        });
      } catch (e) {
        console.error("Share notification error:", e);
      }
    }

    if (toUnshare.length) {
      const result = await WeeklyVideo.deleteMany({
        videoUrl: source.videoUrl,
        therapistId,
        childId: { $in: toUnshare },
      });
      removedCount = result.deletedCount || 0;
    }

    return res.json({ success: true, sharedCount: toShare.length, removedCount });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};