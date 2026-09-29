const { default: mongoose } = require("mongoose");
const Feedback = require("../models/Feedback");
const Scheduling = require("../models/Scheduling");
const TherapistAssignment = require("../models/TherapistAssignment");
const WeeklyVideo = require("../models/Video");

exports.getChildFeedbackManagement = async (req, res) => {
  try {
    const { status } = req.params;
    const childId = req.user?._id || req.user?.id;

    if (!childId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!["all", "pending", "new"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1,
    );

    const limit = 5;
    const skip = (page - 1) * limit;
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(
      startOfYesterday.getDate() - 1,
    );

    const isTodayOrYesterday = (date) => {
      if (!date) {
        return false;
      }

      const sessionDate = new Date(date);

      if (Number.isNaN(sessionDate.getTime())) {
        return false;
      }

      sessionDate.setHours(0, 0, 0, 0);

      return (
        sessionDate.getTime() === startOfToday.getTime()
        || sessionDate.getTime() === startOfYesterday.getTime()
      );
    };

    const buildAppointmentDateTime = (
      date,
      startTime,
    ) => {
      if (!date) {
        return null;
      }

      const appointmentDate = new Date(date);

      if (Number.isNaN(appointmentDate.getTime())) {
        return null;
      }

      const time = String(startTime || "").trim();

      const match24 = time.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
      );

      const match12 = time.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i,
      );

      if (match12) {
        let hours = Number(match12[1]);
        const minutes = Number(match12[2]);
        const seconds = Number(match12[3] || 0);
        const period = match12[4].toUpperCase();

        if (period === "PM" && hours !== 12) {
          hours += 12;
        }

        if (period === "AM" && hours === 12) {
          hours = 0;
        }

        appointmentDate.setHours(
          hours,
          minutes,
          seconds,
          0,
        );

        return appointmentDate;
      }

      if (match24) {
        appointmentDate.setHours(
          Number(match24[1]),
          Number(match24[2]),
          Number(match24[3] || 0),
          0,
        );

        return appointmentDate;
      }

      return appointmentDate;
    };

    const ratingResult = await Feedback.aggregate([
      {
        $match: {
          childId,
          isVisibleToParent: {
            $ne: false,
          },
        },
      },
      {
        $group: {
          _id: null,
          averageRating: {
            $avg: "$rating",
          },
        },
      },
    ]);

    const averageSatisfaction = ratingResult.length > 0
      ? Number(
        Number(
          ratingResult[0].averageRating || 0,
        ).toFixed(1),
      )
      : 0;

    const sinceYesterdayFeedback = await Feedback.countDocuments({
      childId,
      isVisibleToParent: {
        $ne: false,
      },
      createdAt: {
        $gte: startOfYesterday,
      },
    });

    const schedules = await Scheduling.find({
      childId,
    })
      .populate(
        "therapistId",
        "fullName email role profileImage",
      )
      .populate(
        "childId",
        "fullName email role profileImage",
      )
      .lean();

    const therapistIds = schedules
      .map(
        (schedule) =>
          schedule.therapistId?._id
          || schedule.therapistId,
      )
      .filter(Boolean);

    const therapistAssignments = await TherapistAssignment.find({
      therapistId: {
        $in: therapistIds,
      },
    })
      .select(
        "therapistId specialty",
      )
      .lean();

    const specialtyMap = new Map();

    therapistAssignments.forEach(
      (assignment) => {
        specialtyMap.set(
          String(
            assignment.therapistId,
          ),
          assignment.specialty || "",
        );
      },
    );

    const appointmentMap = new Map();

    schedules.forEach((schedule) => {
      const therapistObj = schedule.therapistId;

      const therapistIdStr = therapistObj?._id
        ? String(therapistObj._id)
        : String(therapistObj);

      const specialty = specialtyMap.get(
        therapistIdStr,
      ) || "";

      (schedule.appointments || []).forEach(
        (appointment) => {
          appointmentMap.set(
            String(appointment._id),
            {
              ...appointment,
              therapistId: therapistObj,
              childId: schedule.childId,
              specialty,
            },
          );
        },
      );
    });

    const feedbacks = await Feedback.find({
      childId,
      isVisibleToParent: {
        $ne: false,
      },
    })
      .select(
        "_id therapistId childId appointmentId category notes mood rating isVisibleToParent replies createdAt updatedAt",
      )
      .populate(
        "therapistId",
        "fullName email role profileImage",
      )
      .lean();

    const feedbackAppointmentIds = new Set(
      feedbacks.map(
        (feedback) => String(feedback.appointmentId),
      ),
    );

    const pendingFeedback = [];

    schedules.forEach((schedule) => {
      const therapistObj = schedule.therapistId;

      const therapistIdStr = therapistObj?._id
        ? String(therapistObj._id)
        : String(therapistObj);

      const specialty = specialtyMap.get(
        therapistIdStr,
      ) || "";

      (schedule.appointments || []).forEach(
        (appointment) => {
          const appointmentDateTime = buildAppointmentDateTime(
            appointment.date,
            appointment.startTime,
          );

          if (!appointmentDateTime) {
            return;
          }

          const hasFeedback = feedbackAppointmentIds.has(
            String(appointment._id),
          );

          if (
            appointmentDateTime <= now
            && !hasFeedback
          ) {
            const isNew = isTodayOrYesterday(
              appointment.date,
            );

            pendingFeedback.push({
              appointmentId: appointment._id,
              therapistId: therapistObj,
              childId: schedule.childId,
              specialty,
              isNew,
              session: {
                date: appointment.date,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
                attendanceStatus: appointment.attendance_status,
              },
            });
          }
        },
      );
    });

    pendingFeedback.sort((a, b) => {
      const dateA = buildAppointmentDateTime(
        a.session.date,
        a.session.startTime,
      );

      const dateB = buildAppointmentDateTime(
        b.session.date,
        b.session.startTime,
      );

      return (
        new Date(dateA)
        - new Date(dateB)
      );
    });

    if (status === "all") {
      const sortedFeedback = [...feedbacks].sort(
        (a, b) =>
          new Date(b.createdAt)
          - new Date(a.createdAt),
      );

      const total = sortedFeedback.length;

      const paginatedFeedback = sortedFeedback.slice(
        skip,
        skip + limit,
      );

      const data = paginatedFeedback.map(
        (feedback) => {
          return formatFeedbackResponse(
            feedback,
            appointmentMap,
            specialtyMap,
            childId,
            isTodayOrYesterday,
          );
        },
      );

      return res.status(200).json({
        success: true,
        status,
        page,
        limit,
        count: data.length,
        total,
        hasMore: skip + data.length < total,
        stats: {
          pendingFeedback: pendingFeedback.length,
          sinceYesterdayFeedback,
          averageSatisfaction,
        },

        data,
      });
    }

    if (status === "pending") {
      const total = pendingFeedback.length;

      const data = pendingFeedback.slice(
        skip,
        skip + limit,
      );

      return res.status(200).json({
        success: true,
        status,
        page,
        limit,
        count: data.length,
        total,
        hasMore: skip + data.length < total,
        stats: {
          pendingFeedback: pendingFeedback.length,
          sinceYesterdayFeedback,
          averageSatisfaction,
        },

        data,
      });
    }

    if (status === "new") {
      const newPending = pendingFeedback.filter(
        (item) => item.isNew === true,
      );

      const newFeedback = feedbacks.filter(
        (feedback) => {
          const appointment = appointmentMap.get(
            String(
              feedback.appointmentId,
            ),
          );

          if (!appointment?.date) {
            return false;
          }

          return isTodayOrYesterday(
            appointment.date,
          );
        },
      );

      const mappedPending = newPending.map((item) => ({
        id: item.appointmentId,
        appointmentId: item.appointmentId,
        therapistId: item.therapistId,
        childId: item.childId,
        name: item.therapistId?.fullName
          || "",
        specialty: item.specialty || "",
        role: item.therapistId?.role
          || "",
        rating: null,
        comment: `Session on ${
          new Date(
            item.session.date,
          ).toLocaleDateString()
        } (${item.session.startTime || ""} - ${item.session.endTime || ""}) is awaiting feedback.`,
        avatar: item.therapistId?.profileImage || null,
        primaryAction: "Give Feedback",
        primaryIcon: "corner-up-left",
        actionType: "primary",
        secondaryAction: "Delete",
        secondaryIcon: "trash-2",
        tab: "new",
        statusLabel: "New",
        isNew: true,
        isRespond: false,
        canReply: true,
        childName: item.childId?.fullName || "You",
        startTime: item.session.startTime || "--:--",
        endTime: item.session.endTime || "--:--",
        date: item.session.date || null,
        sessionDate: item.session.date || null,
        moodLabel: "No reaction",
        moodEmoji: "",
        category: item.category
          || "Unknown",

        replies: [],
      }));

      const mappedFeedback = newFeedback.map(
        (feedback) => {
          const result = formatFeedbackResponse(
            feedback,
            appointmentMap,
            specialtyMap,
            childId,
            isTodayOrYesterday,
          );

          return {
            ...result,
            tab: "new",
            isNew: true,
          };
        },
      );

      const combined = [
        ...mappedPending,
        ...mappedFeedback,
      ];

      combined.sort((a, b) => {
        const dateA = new Date(
          a.sessionDate
            || a.date
            || 0,
        );

        const dateB = new Date(
          b.sessionDate
            || b.date
            || 0,
        );

        return dateB - dateA;
      });

      const total = combined.length;

      const data = combined.slice(
        skip,
        skip + limit,
      );

      return res.status(200).json({
        success: true,
        status,
        page,
        limit,
        count: data.length,
        total,
        hasMore: skip + data.length < total,

        stats: {
          pendingFeedback: pendingFeedback.length,

          sinceYesterdayFeedback,

          averageSatisfaction,
        },

        data,
      });
    }
  } catch (error) {
    console.error(
      "getChildFeedbackManagement error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch feedback",
      error: error.message,
    });
  }
};

function formatFeedbackResponse(
  feedback,
  appointmentMap,
  specialtyMap,
  childId,
  isTodayOrYesterday,
) {
  const appointment = appointmentMap.get(
    String(
      feedback.appointmentId,
    ),
  );

  const therapistObj = feedback.therapistId
    || appointment?.therapistId;

  const therapistIdStr = therapistObj?._id
    ? String(
      therapistObj._id,
    )
    : String(
      therapistObj,
    );

  const specialty = appointment?.specialty
    || specialtyMap.get(
      therapistIdStr,
    )
    || "";

  const myReplies = Array.isArray(
      feedback.replies,
    )
    ? feedback.replies.filter(
      (reply) =>
        String(
          reply.repliedBy,
        )
          === String(childId),
    )
    : [];

  const isNew = appointment?.date
    ? isTodayOrYesterday(
      appointment.date,
    )
    : false;

  return {
    id: feedback._id,
    appointmentId: feedback.appointmentId,
    therapistId: feedback.therapistId,
    childId: feedback.childId,
    name: therapistObj?.fullName || "",
    specialty,
    role: therapistObj?.role || "",
    rating: typeof feedback.rating === "number"
      ? feedback.rating
      : 0,

    comment: typeof feedback.notes === "string"
      ? feedback.notes.trim()
      : "",

    avatar: therapistObj?.profileImage || null,
    primaryAction: myReplies.length > 0 ? "View Reply" : "Reply",
    primaryIcon: myReplies.length > 0 ? undefined : "corner-up-left",

    actionType: myReplies.length > 0
      ? "outline"
      : "primary",

    secondaryAction: "Delete",
    secondaryIcon: "trash-2",
    tab: isNew
      ? "new"
      : "all",
    statusLabel: myReplies.length > 0
      ? "Responded"
      : isNew
      ? "New"
      : "Feedback",
    isRespond: myReplies.length > 0,
    canReply: true,
    isNew,
    childName: feedback.childId?.fullName
      || "You",
    startTime: appointment?.startTime
      || "--:--",

    endTime: appointment?.endTime
      || "--:--",

    date: appointment?.date
      || null,

    sessionDate: appointment?.date
      || null,

    moodLabel: feedback.mood
      || "No reaction",

    moodEmoji: "",

    category: feedback.category
      || "Unknown",

    replies: Array.isArray(
        feedback.replies,
      )
      ? feedback.replies
      : [],

    myReplies,
  };
}

exports.createChildFeedback = async (req, res) => {
  try {
    const childId = req.user?._id || req.user?.id;

    if (!childId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      appointmentId,
      therapistId,
      category,
      notes,
      mood,
      rating,
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    if (!therapistId) {
      return res.status(400).json({
        success: false,
        message: "Therapist ID is required",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    if (!notes || !notes.trim()) {
      return res.status(400).json({
        success: false,
        message: "Feedback notes are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(therapistId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid therapist ID",
      });
    }

    const scheduling = await Scheduling.findOne({
      childId,
      therapistId,
      "appointments._id": appointmentId,
    }).lean();

    if (!scheduling) {
      return res.status(403).json({
        success: false,
        message: "This appointment does not belong to this child",
      });
    }

    const appointment = scheduling.appointments.find(
      (item) => String(item._id) === String(appointmentId),
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const existingFeedback = await Feedback.findOne({
      childId,
      therapistId,
      appointmentId: String(appointmentId),
    });

    if (existingFeedback) {
      const alreadyReplied = existingFeedback.replies.some(
        (reply) =>
          String(reply.repliedBy) === String(childId)
          && reply.repliedByRole === "Child",
      );

      if (alreadyReplied) {
        return res.status(409).json({
          success: false,
          message: "You have already submitted feedback for this appointment",
        });
      }

      existingFeedback.replies.push({
        repliedBy: childId,
        repliedByRole: "Child",
        message: notes.trim(),
      });

      await existingFeedback.save();

      const populatedFeedback = await Feedback.findById(
        existingFeedback._id,
      )
        .populate(
          "therapistId",
          "fullName email role",
        )
        .populate(
          "childId",
          "fullName email role",
        )
        .populate(
          "replies.repliedBy",
          "fullName email role profileImage",
        )
        .lean();

      return res.status(201).json({
        success: true,
        message: "Feedback submitted successfully",
        data: populatedFeedback,
      });
    }

    const validMoods = [
      "Happy",
      "Neutral",
      "Sad",
      "Anxious",
      "Calm",
      "Frustrated",
      "Excited",
    ];

    if (mood && !validMoods.includes(mood)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mood",
      });
    }

    let feedbackRating = 5;

    if (
      rating !== undefined
      && rating !== null
      && rating !== ""
    ) {
      feedbackRating = Number(rating);

      if (
        Number.isNaN(feedbackRating)
        || feedbackRating < 1
        || feedbackRating > 5
      ) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        });
      }
    }

    const feedback = await Feedback.create({
      therapistId,
      childId,
      appointmentId: String(appointmentId),
      category: category.trim(),
      notes: null,
      mood: mood || "Neutral",
      rating: feedbackRating,
      isVisibleToParent: true,
      replies: [
        {
          repliedBy: childId,
          repliedByRole: "Child",
          message: notes.trim(),
        },
      ],
    });

    const populatedFeedback = await Feedback.findById(feedback._id)
      .populate(
        "therapistId",
        "fullName email role",
      )
      .populate(
        "childId",
        "fullName email role",
      )
      .populate(
        "replies.repliedBy",
        "fullName email role profileImage",
      )
      .lean();

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: populatedFeedback,
    });
  } catch (error) {
    console.error(
      "createChildFeedback error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to submit feedback",
      error: error.message,
    });
  }
};

exports.addChildFeedbackReply = async (
  req,
  res,
) => {
  try {
    const childId = req.user?._id || req.user?.id;

    if (!childId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { feedbackId } = req.params;
    const { message } = req.body;

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

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required",
      });
    }

    const feedback = await Feedback.findOne({
      appointmentId: feedbackId,
      childId,
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    feedback.replies.push({
      repliedBy: childId,
      repliedByRole: "Child",
      message: message.trim(),
    });

    await feedback.save();

    const updatedFeedback = await Feedback.findById(feedback._id)
      .populate(
        "therapistId",
        "fullName email role",
      )
      .populate(
        "childId",
        "fullName email role",
      )
      .populate(
        "replies.repliedBy",
        "fullName email role",
      )
      .lean();

    return res.status(200).json({
      success: true,
      message: "Reply added successfully",
      data: updatedFeedback,
      replies: updatedFeedback.replies,
    });
  } catch (error) {
    console.error(
      "addChildFeedbackReply error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to add reply",
      error: error.message,
    });
  }
};

exports.deleteChildFeedback = async (req, res) => {
  try {
    const childId = req.user?._id || req.user?.id;

    if (!childId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { feedbackId } = req.params;

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

    const feedback = await Feedback.findOne({
      _id: feedbackId,
      childId,
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    const hasChildReply = Array.isArray(feedback.replies)
      && feedback.replies.some(
        (reply) =>
          String(reply.repliedBy)
            === String(childId),
      );

    if (!hasChildReply) {
      return res.status(403).json({
        success: false,
        message: "You can delete feedback only after replying to it",
      });
    }

    // await Feedback.deleteOne({
    //   _id: feedbackId,
    //   childId,
    // });

    await Feedback.updateOne(
      { _id: feedbackId, childId },
      {
        $pull: {
          replies: { repliedBy: childId },
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Feedback deleted successfully",
      feedbackId,
    });
  } catch (error) {
    console.error(
      "deleteChildFeedback error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete feedback",
      error: error.message,
    });
  }
};

exports.getChildFeedbackReplies = async (req, res) => {
  try {
    const childId = req.user?._id || req.user?.id;
    const { appointmentId } = req.params;

    if (!childId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    const feedback = await Feedback.findOne({
      childId,
      appointmentId: String(appointmentId),
    })
      .populate(
        "therapistId",
        "fullName email role profileImage",
      )
      .populate(
        "childId",
        "fullName email role profileImage",
      )
      .populate(
        "replies.repliedBy",
        "fullName email role profileImage",
      )
      .lean();

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found for this appointment",
        replies: [],
      });
    }

    return res.status(200).json({
      success: true,
      appointmentId,
      feedbackId: feedback._id,
      replies: feedback.replies || [],
    });
  } catch (error) {
    console.error(
      "getChildFeedbackReplies error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch feedback replies",
      error: error.message,
    });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const childId = req.user?._id || req.user?.id;

    const {
      fromDate,
      toDate,
      filter,
      page = 1,
      limit = 5,
    } = req.query;

    if (!childId) {
      return res.status(401).json({
        success: false,
        message: "Child not authenticated",
      });
    }

    const currentPage = Math.max(
      parseInt(page, 10) || 1,
      1,
    );

    const pageLimit = Math.min(
      Math.max(parseInt(limit, 10) || 5, 1),
      20,
    );

    const records = await Scheduling.find({
      childId,
    }).lean();

    let startDate = null;
    let endDate = null;

    if (filter === "today") {
      const today = new Date();

      const year = today.getUTCFullYear();
      const month = today.getUTCMonth();
      const day = today.getUTCDate();

      startDate = new Date(
        Date.UTC(year, month, day, 0, 0, 0, 0),
      );

      endDate = new Date(
        Date.UTC(year, month, day, 23, 59, 59, 999),
      );
    } else {
      if (fromDate) {
        startDate = new Date(
          `${fromDate}T00:00:00.000Z`,
        );
      }

      if (toDate) {
        endDate = new Date(
          `${toDate}T23:59:59.999Z`,
        );
      }
    }

    const attendance = [];

    records.forEach((record) => {
      if (!Array.isArray(record.appointments)) {
        return;
      }

      record.appointments.forEach((appointment) => {
        if (!appointment.date) {
          return;
        }

        const appointmentDate = new Date(
          appointment.date,
        );

        if (Number.isNaN(appointmentDate.getTime())) {
          return;
        }

        if (
          startDate
          && appointmentDate < startDate
        ) {
          return;
        }

        if (
          endDate
          && appointmentDate > endDate
        ) {
          return;
        }

        attendance.push({
          id: String(appointment._id),
          childId: String(childId),
          date: appointmentDate
            .toISOString()
            .split("T")[0],
          startTime: appointment.startTime || "",
          endTime: appointment.endTime || "",
          attendance_status: appointment.attendance_status || "Pending",
        });
      });
    });

    attendance.sort((a, b) => {
      const dateA = new Date(
        `${a.date}T${a.startTime || "00:00"}:00`,
      );

      const dateB = new Date(
        `${b.date}T${b.startTime || "00:00"}:00`,
      );

      return dateB - dateA;
    });

    const total = attendance.length;

    const totalPages = Math.ceil(
      total / pageLimit,
    );

    const skip = (currentPage - 1) * pageLimit;

    const paginatedData = attendance.slice(
      skip,
      skip + pageLimit,
    );

    return res.status(200).json({
      success: true,
      filter: filter || "history",
      data: paginatedData,
      total,
      count: paginatedData.length,
      page: currentPage,
      limit: pageLimit,
      totalPages,
      hasMore: currentPage < totalPages,
    });
  } catch (error) {
    console.error("getAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getVideosByChild = async (req, res) => {
  try {
    const { childId } = req.params;

    if (!childId) {
      return res.status(401).json({
        success: false,
        message: "Child authentication is required.",
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
