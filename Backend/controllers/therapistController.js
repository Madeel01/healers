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


exports.getChildPrograms = async (req, res) => {
  try {
    const therapistId =
      req.query.therapistId ||
      req.user?._id ||
      req.user?.id;

    const { childId } = req.params;

    if (
      therapistId &&
      !mongoose.Types.ObjectId.isValid(therapistId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid therapist ID.",
      });
    }

    if (
      childId &&
      !mongoose.Types.ObjectId.isValid(childId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid child ID.",
      });
    }

    const matchQuery = {};

    if (therapistId) {
      matchQuery.therapistId =
        new mongoose.Types.ObjectId(therapistId);
    }

    if (childId) {
      matchQuery.childIds =
        new mongoose.Types.ObjectId(childId);
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


// exports.getChildPrograms = async (req, res) => {
//   try {
//     const { childId } = req.params;
//     const therapistId = req.query.therapistId || req.user?._id || req.user?.id;

//     if (!childId || !therapistId) {
//       return res.status(400).json({
//         success: false,
//         message: "Both childId and therapistId are required.",
//       });
//     }

//     const programs = await Program.find({
//       userId: childId,
//       therapistId: therapistId,
//     }).sort({ createdAt: -1 });

//     return res.status(200).json({
//       success: true,
//       count: programs.length,
//       data: programs,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

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

exports.getAttendance = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;
    const {
      childId,
      year,
      month,
      filter,
    } = req.query;

    if (!therapistId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const isTodayFilter = filter === "true"
      || filter === true;

    const now = new Date();

    const query = {
      therapistId,
    };

    if (isTodayFilter) {
      query.year = now.getFullYear();
      query.month = now.getMonth() + 1;
    } else {
      if (year) {
        query.year = Number(year);
      }

      if (month) {
        query.month = Number(month);
      }
    }

    const schedules = await Scheduling.find(query)
      .populate(
        "appointments.children.childId",
        "fullName name fatherName parentName profileImage",
      )
      .lean();

    const data = [];

    schedules.forEach((schedule) => {
      (schedule.appointments || []).forEach((appointment) => {
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

        if (isTodayFilter) {
          const isToday = appointmentDate.getFullYear()
              === now.getFullYear()
            && appointmentDate.getMonth()
              === now.getMonth()
            && appointmentDate.getDate()
              === now.getDate();

          if (!isToday) {
            return;
          }
        }

        (appointment.children || []).forEach((childEntry) => {
          const child = childEntry.childId;

          if (!child) {
            return;
          }

          const currentChildId = String(
            child._id || child,
          );

          if (
            childId
            && currentChildId !== String(childId)
          ) {
            return;
          }

          data.push({
            attendanceId: String(
              schedule._id,
            ),
            appointmentId: String(
              appointment._id,
            ),
            childAttendanceId: childEntry._id
              ? String(childEntry._id)
              : null,
            childId: currentChildId,
            childName: child.fullName
              || child.name
              || "Unknown Child",
            fatherName: child.fatherName || "",
            parentName: child.parentName || "",
            profileImage: child.profileImage || "",
            date: appointment.date,
            startTime: appointment.startTime || "",
            endTime: appointment.endTime || "",
            attendanceStatus: childEntry.attendance_status
              || "Pending",
          });
        });
      });
    });

    data.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      if (a.startTime) {
        const [hours, minutes] = a.startTime
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
        const [hours, minutes] = b.startTime
          .split(":")
          .map(Number);

        dateB.setHours(
          hours || 0,
          minutes || 0,
          0,
          0,
        );
      }

      return dateA.getTime()
        - dateB.getTime();
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error(
      "getAttendance error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: error.message,
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

    if (video.cloudinaryPublicId) {
      try {
        const cloudinaryResult = await cloudinary.uploader.destroy(
          video.cloudinaryPublicId,
          {
            resource_type: video.cloudinaryResourceType || "video",

            type: "upload",

            invalidate: true,
          },
        );

        console.log(
          "Cloudinary delete result:",
          cloudinaryResult,
        );

        if (
          cloudinaryResult.result !== "ok"
          && cloudinaryResult.result !== "not found"
        ) {
          console.warn(
            "Cloudinary asset was not deleted:",
            cloudinaryResult,
          );
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

    await WeeklyVideo.deleteOne({
      _id: video._id,
    });

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully.",
      data: {
        id: video._id,
        cloudinaryDeleted: !!video.cloudinaryPublicId,
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
