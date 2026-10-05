const { default: mongoose } = require("mongoose");
const Feedback = require("../models/Feedback");
const Scheduling = require("../models/Scheduling");
const TherapistAssignment = require("../models/TherapistAssignment");
const WeeklyVideo = require("../models/Video");
const User = require("../models/User");
const Complaint = require("../models/Complaint");

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

    const getDateKey = (date) => {
      if (!date) {
        return null;
      }

      const parsed = new Date(date);

      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      const year = parsed.getUTCFullYear();
      const month = String(
        parsed.getUTCMonth() + 1,
      ).padStart(2, "0");
      const day = String(
        parsed.getUTCDate(),
      ).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    const todayKey = getDateKey(now);

    const yesterday = new Date(now);
    yesterday.setUTCDate(
      yesterday.getUTCDate() - 1,
    );

    const yesterdayKey = getDateKey(
      yesterday,
    );

    const isTodayOrYesterday = (date) => {
      const dateKey = getDateKey(date);

      if (!dateKey) {
        return false;
      }

      return (
        dateKey === todayKey
        || dateKey === yesterdayKey
      );
    };

    const buildAppointmentDateTime = (
      date,
      time,
    ) => {
      if (!date) {
        return null;
      }

      const appointmentDate = new Date(date);

      if (
        Number.isNaN(
          appointmentDate.getTime(),
        )
      ) {
        return null;
      }

      const value = String(
        time || "",
      ).trim();

      const match24 = value.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
      );

      const match12 = value.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i,
      );

      if (match12) {
        let hours = Number(match12[1]);
        const minutes = Number(match12[2]);
        const seconds = Number(
          match12[3] || 0,
        );
        const period = match12[4].toUpperCase();

        if (
          period === "PM"
          && hours !== 12
        ) {
          hours += 12;
        }

        if (
          period === "AM"
          && hours === 12
        ) {
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

      appointmentDate.setHours(
        23,
        59,
        59,
        999,
      );

      return appointmentDate;
    };

    const ratingResult = await Feedback.aggregate([
      {
        $match: {
          childId: new mongoose.Types.ObjectId(
            String(childId),
          ),
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

    const averageSatisfaction = ratingResult.length
      ? Number(
        Number(
          ratingResult[0]
            .averageRating || 0,
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
      "appointments.children.childId": childId,
    })
      .populate(
        "therapistId",
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
        : String(
          therapistObj || "",
        );

      const specialty = specialtyMap.get(
        therapistIdStr,
      ) || "";

      (
        schedule.appointments || []
      ).forEach((appointment) => {
        const childEntry = (
          appointment.children || []
        ).find(
          (child) =>
            child?.childId
            && String(child.childId)
              === String(childId),
        );

        if (!childEntry) {
          return;
        }

        appointmentMap.set(
          String(appointment._id),
          {
            ...appointment,
            therapistId: therapistObj,
            childId: childEntry.childId,
            childAttendanceId: childEntry._id,
            attendance_status: childEntry
              .attendance_status
              || "Pending",
            specialty,
          },
        );
      });
    });

    const allFeedbacks = await Feedback.find({
      childId,
    })
      .select(
        [
          "_id",
          "therapistId",
          "childId",
          "appointmentId",
          "category",
          "notes",
          "mood",
          "rating",
          "isVisibleToParent",
          "replies",
          "createdAt",
          "updatedAt",
        ].join(" "),
      )
      .populate(
        "therapistId",
        "fullName email role profileImage",
      )
      .populate({
        path: "replies.repliedBy",
        select: "fullName email role profileImage",
      })
      .lean();

    const feedbacks = allFeedbacks.filter(
      (feedback) =>
        feedback.isVisibleToParent
          !== false,
    );

    const feedbackAppointmentIds = new Set(
      allFeedbacks
        .filter(
          (feedback) => feedback.appointmentId,
        )
        .map(
          (feedback) =>
            String(
              feedback.appointmentId,
            ),
        ),
    );

    const pendingFeedback = [];

    schedules.forEach((schedule) => {
      const therapistObj = schedule.therapistId;

      const therapistIdStr = therapistObj?._id
        ? String(therapistObj._id)
        : String(
          therapistObj || "",
        );

      const specialty = specialtyMap.get(
        therapistIdStr,
      ) || "";

      (
        schedule.appointments || []
      ).forEach((appointment) => {
        const childEntry = (
          appointment.children || []
        ).find(
          (child) =>
            child?.childId
            && String(child.childId)
              === String(childId),
        );

        if (!childEntry) {
          return;
        }

        const appointmentEndDateTime = buildAppointmentDateTime(
          appointment.date,
          appointment.endTime,
        );

        if (
          !appointmentEndDateTime
        ) {
          return;
        }

        const hasFeedback = feedbackAppointmentIds.has(
          String(
            appointment._id,
          ),
        );

        const isPrevious = appointmentEndDateTime
          .getTime()
          < now.getTime();

        if (
          !hasFeedback
          && isPrevious
        ) {
          pendingFeedback.push({
            appointmentId: appointment._id,
            childAttendanceId: childEntry._id,
            therapistId: therapistObj,
            childId: childEntry.childId,
            specialty,
            isNew: isTodayOrYesterday(
              appointment.date,
            ),
            session: {
              date: appointment.date,
              startTime: appointment.startTime,
              endTime: appointment.endTime,
              attendanceStatus: childEntry
                .attendance_status
                || "Pending",
              type: appointment.type
                || null,
              sessionType: appointment
                .sessionType
                || "regular",
              batchSessionId: appointment
                .batchSessionId
                || null,
              batchId: appointment.batchId
                || null,
              batchAssignmentId: appointment
                .batchAssignmentId
                || null,
            },
          });
        }
      });
    });

    pendingFeedback.sort(
      (a, b) => {
        const dateA = buildAppointmentDateTime(
          a.session.date,
          a.session.endTime,
        );

        const dateB = buildAppointmentDateTime(
          b.session.date,
          b.session.endTime,
        );

        return (
          new Date(dateB).getTime()
          - new Date(dateA).getTime()
        );
      },
    );

    const mapPendingItem = (
      item,
      tab,
    ) => ({
      id: String(
        item.appointmentId,
      ),
      appointmentId: String(
        item.appointmentId,
      ),
      childAttendanceId: item.childAttendanceId
        ? String(
          item.childAttendanceId,
        )
        : null,
      therapistId: item.therapistId?._id
        ? String(
          item.therapistId._id,
        )
        : null,
      childId: String(
        item.childId,
      ),
      name: item.therapistId
        ?.fullName || "",
      therapistName: item.therapistId
        ?.fullName || "",
      therapistEmail: item.therapistId
        ?.email || "",
      specialty: item.specialty || "",
      role: item.therapistId?.role
        || "Therapist",
      avatar: item.therapistId
        ?.profileImage
        || null,
      rating: null,
      comment: "",
      primaryAction: "Add Feedback",
      primaryIcon: "plus",
      actionType: "primary",
      secondaryAction: null,
      secondaryIcon: null,
      tab,
      statusLabel: tab === "new"
        ? "New"
        : "Pending",
      isNew: item.isNew,
      isPending: true,
      isRespond: false,
      canReply: false,
      childName: "You",
      startTime: item.session.startTime
        || "--:--",
      endTime: item.session.endTime
        || "--:--",
      date: item.session.date
        || null,
      sessionDate: item.session.date
        || null,
      attendanceStatus: item.session
        .attendanceStatus
        || "Pending",
      sessionType: item.session
        .sessionType
        || "regular",
      type: item.session.type
        || null,
      batchSessionId: item.session
        .batchSessionId
        || null,
      batchId: item.session.batchId
        || null,
      batchAssignmentId: item.session
        .batchAssignmentId
        || null,
      moodLabel: "No reaction",
      moodEmoji: "",
      category: "Unknown",
      replies: [],
      myReplies: [],
    });

    if (status === "all") {
      const sortedFeedback = [
        ...feedbacks,
      ].sort(
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
        (feedback) =>
          formatFeedbackResponse(
            feedback,
            appointmentMap,
            specialtyMap,
            childId,
            isTodayOrYesterday,
          ),
      );

      return res.status(200).json({
        success: true,
        status,
        page,
        limit,
        count: data.length,
        total,
        hasMore: skip + data.length
          < total,
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

      const paginatedPending = pendingFeedback.slice(
        skip,
        skip + limit,
      );

      const data = paginatedPending.map(
        (item) =>
          mapPendingItem(
            item,
            "pending",
          ),
      );

      return res.status(200).json({
        success: true,
        status,
        page,
        limit,
        count: data.length,
        total,
        hasMore: skip + data.length
          < total,
        stats: {
          pendingFeedback: pendingFeedback.length,
          sinceYesterdayFeedback,
          averageSatisfaction,
        },
        data,
      });
    }

    if (status === "new") {
      const newFeedback = feedbacks
        .filter((feedback) => {
          const appointment = appointmentMap.get(
            String(
              feedback
                .appointmentId,
            ),
          );

          if (
            !appointment?.date
          ) {
            return false;
          }

          return (
            isTodayOrYesterday(
              appointment.date,
            )
          );
        })
        .map((feedback) => {
          const item = formatFeedbackResponse(
            feedback,
            appointmentMap,
            specialtyMap,
            childId,
            isTodayOrYesterday,
          );

          return {
            ...item,
            tab: "new",
            isNew: true,
            statusLabel: item.isRespond
              ? "Responded"
              : "New",
          };
        })
        .sort((a, b) => {
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

      const total = newFeedback.length;

      const data = newFeedback.slice(
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
        hasMore: skip + data.length
          < total,
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
      therapistObj || "",
    );

  const specialty = appointment?.specialty
    || specialtyMap.get(
      therapistIdStr,
    )
    || "";

  const replies = Array.isArray(
      feedback.replies,
    )
    ? feedback.replies
    : [];

  const myReplies = replies.filter((reply) => {
    const repliedById = reply.repliedBy?._id
      || reply.repliedBy?.id
      || reply.repliedBy;

    return (
      String(repliedById)
        === String(childId)
      && reply.repliedByRole
        === "Child"
    );
  });

  const isResponded = myReplies.length > 0;

  const isNew = appointment?.date
    ? isTodayOrYesterday(
      appointment.date,
    )
    : false;

  return {
    id: String(
      feedback._id,
    ),
    appointmentId: String(
      feedback.appointmentId,
    ),
    therapistId: feedback.therapistId,
    childId: feedback.childId,
    name: therapistObj?.fullName
      || "",
    therapistName: therapistObj?.fullName
      || "",
    therapistEmail: therapistObj?.email
      || "",
    specialty,
    role: therapistObj?.role
      || "Therapist",
    rating: typeof feedback.rating
        === "number"
      ? feedback.rating
      : 0,
    comment: typeof feedback.notes
        === "string"
      ? feedback.notes.trim()
      : "",
    avatar: therapistObj?.profileImage
      || null,
    primaryAction: isResponded
      ? "View Reply"
      : "Add Reply",
    primaryIcon: isResponded
      ? undefined
      : "corner-up-left",
    actionType: isResponded
      ? "outline"
      : "primary",
    secondaryAction: isResponded
      ? "Delete"
      : null,
    secondaryIcon: isResponded
      ? "trash-2"
      : null,
    statusLabel: isResponded
      ? "Responded"
      : isNew
      ? "New"
      : "Feedback",
    isRespond: isResponded,
    canReply: !isResponded,
    isPending: false,
    isNew,
    childName: "You",
    startTime: appointment?.startTime
      || "--:--",
    endTime: appointment?.endTime
      || "--:--",
    date: appointment?.date
      || null,
    sessionDate: appointment?.date
      || null,
    attendanceStatus: appointment
      ?.attendance_status
      || "Pending",
    sessionType: appointment?.sessionType
      || "regular",
    type: appointment?.type
      || null,
    batchSessionId: appointment
      ?.batchSessionId
      || null,
    batchId: appointment?.batchId
      || null,
    batchAssignmentId: appointment
      ?.batchAssignmentId
      || null,
    moodLabel: feedback.mood
      || "No reaction",
    moodEmoji: "",
    category: feedback.category
      || "Unknown",
    replies,
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

    if (!category?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    if (!notes?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Feedback notes are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(therapistId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid therapist ID",
      });
    }

    const scheduling = await Scheduling.findOne({
      therapistId,
      appointments: {
        $elemMatch: {
          _id: appointmentId,
          "children.childId": childId,
        },
      },
    }).lean();

    if (!scheduling) {
      return res.status(403).json({
        success: false,
        message: "This appointment does not belong to this child",
      });
    }

    const appointment = scheduling.appointments.find(
      (item) =>
        String(item._id) === String(appointmentId)
        && item.children?.some(
          (child) => String(child.childId) === String(childId),
        ),
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
      appointmentId,
    });

    if (existingFeedback) {
      return res.status(409).json({
        success: false,
        message: "Feedback already exists for this appointment",
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

    const populatedFeedback = await Feedback.findById(
      feedback._id,
    )
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

exports.addChildFeedbackReply = async (req, res) => {
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

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required",
      });
    }

    const feedback = await Feedback.findOne({
      _id: feedbackId,
      childId,
      isVisibleToParent: {
        $ne: false,
      },
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

    const updatedFeedback = await Feedback.findById(
      feedback._id,
    )
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

    return res.status(200).json({
      success: true,
      message: "Reply added successfully",
      data: updatedFeedback,
      replies: updatedFeedback.replies || [],
    });
  } catch (error) {
    console.error("addChildFeedbackReply error:", error);

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

    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
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

    const hasChildReply = feedback.replies?.some(
      (reply) =>
        String(reply.repliedBy) === String(childId)
        && reply.repliedByRole === "Child",
    );

    if (!hasChildReply) {
      return res.status(403).json({
        success: false,
        message: "You have not replied to this feedback",
      });
    }

    feedback.replies = feedback.replies.filter(
      (reply) =>
        !(
          String(reply.repliedBy) === String(childId)
          && reply.repliedByRole === "Child"
        ),
    );

    await feedback.save();

    const updatedFeedback = await Feedback.findById(
      feedback._id,
    )
      .populate(
        "replies.repliedBy",
        "fullName email role profileImage",
      )
      .lean();

    return res.status(200).json({
      success: true,
      message: "Reply deleted successfully",
      feedbackId: String(feedback._id),
      appointmentId: String(feedback.appointmentId),
      replies: updatedFeedback?.replies || [],
    });
  } catch (error) {
    console.error(
      "deleteChildFeedback error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete reply",
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
    const { fromDate, toDate, filter, page = 1, limit = 5 } = req.query;

    if (!childId) {
      return res.status(401).json({
        success: false,
        message: "Child not authenticated",
      });
    }

    const childObjectId = new mongoose.Types.ObjectId(
      String(childId),
    );

    const currentPage = Math.max(
      parseInt(page, 10) || 1,
      1,
    );

    const pageLimit = Math.min(
      Math.max(parseInt(limit, 10) || 5, 1),
      20,
    );

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
        const parsedFromDate = new Date(
          `${fromDate}T00:00:00.000Z`,
        );

        if (!Number.isNaN(parsedFromDate.getTime())) {
          startDate = parsedFromDate;
        }
      }

      if (toDate) {
        const parsedToDate = new Date(
          `${toDate}T23:59:59.999Z`,
        );

        if (!Number.isNaN(parsedToDate.getTime())) {
          endDate = parsedToDate;
        }
      }
    }

    const records = await Scheduling.find({
      "appointments.children.childId": childObjectId,
    })
      .populate({
        path: "therapistId",
        model: "User",
        select: "fullName",
      })
      .lean();

    const attendance = [];

    records.forEach((record) => {
      if (!Array.isArray(record.appointments)) {
        return;
      }

      const therapist = record.therapistId || null;

      const therapistId = therapist?._id
        ? String(therapist._id)
        : null;

      const therapistName = therapist?.fullName || "";

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

        if (!Array.isArray(appointment.children)) {
          return;
        }

        const childAttendance = appointment.children.find(
          (child) =>
            child?.childId
            && String(child.childId)
              === String(childObjectId),
        );

        if (!childAttendance) {
          return;
        }

        attendance.push({
          id: String(appointment._id),

          childAttendanceId: childAttendance._id
            ? String(childAttendance._id)
            : null,

          childId: String(childObjectId),

          date: appointmentDate
            .toISOString()
            .split("T")[0],

          startTime: appointment.startTime || "",

          endTime: appointment.endTime || "",

          attendance_status: childAttendance.attendance_status
            || "Pending",

          therapistId,

          therapistName,

          type: appointment.type || null,

          sessionType: appointment.sessionType
            || "regular",

          batchSessionId: appointment.batchSessionId
            ? String(appointment.batchSessionId)
            : null,

          batchId: appointment.batchId
            ? String(appointment.batchId)
            : null,

          batchAssignmentId: appointment.batchAssignmentId
            ? String(
              appointment.batchAssignmentId,
            )
            : null,

          originalAppointmentId: appointment.originalAppointmentId
            ? String(
              appointment.originalAppointmentId,
            )
            : null,
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

      return dateA - dateB;
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

exports.getAssignMembers = async (req, res) => {
  try {
    const targetId = req?.query?.userId
      || req?.query?.therapistId
      || req?.params?.userId
      || req?.params?.therapistId
      || req?.body?.userId
      || req?.body?.therapistId
      || req?.user?._id
      || req?.user?.id;

    const role = req?.query?.role
      || req?.body?.role
      || req?.user?.role;

    if (role === "Admin") {
      const allAssignments = await TherapistAssignment.find()
        .populate({
          path: "therapistId",
          select: "_id fullName profileImage isOnline lastActive role",
        })
        .populate({
          path: "childIds",
          select: "_id fullName profileImage isOnline lastActive role",
        })
        .lean();

      const formattedData = allAssignments.map((assignment) => ({
        assignmentId: assignment._id,
        specialty: assignment.specialty || "",
        maxChildren: assignment.maxChildren || 0,
        therapist: assignment.therapistId
          ? {
            id: assignment.therapistId._id,
            fullName: assignment.therapistId.fullName,
            profileImage: assignment.therapistId.profileImage || "",
            isOnline: assignment.therapistId.isOnline,
            lastActive: assignment.therapistId.lastActive ?? null,
            role: assignment.therapistId.role || "therapist",
          }
          : null,
        assignedChildren: Array.isArray(assignment.childIds)
          ? assignment.childIds.map((child) => ({
            id: child._id,
            fullName: child.fullName,
            profileImage: child.profileImage || "",
            isOnline: child.isOnline,
            lastActive: child.lastActive ?? null,
            role: child.role || "child",
          }))
          : [],
      }));

      return res.status(200).json({
        success: true,
        count: formattedData.length,
        data: formattedData,
      });
    }

    if (!targetId) {
      return res.status(400).json({
        success: false,
        message: "Therapist ID or User ID is required",
      });
    }

    if (role === "Therapist") {
      const assignments = await TherapistAssignment.find({
        therapistId: targetId,
      })
        .populate({
          path: "childIds",
          select: "_id fullName profileImage isOnline lastActive role",
        })
        .lean();

      const childrenMap = new Map();

      assignments.forEach((item) => {
        if (Array.isArray(item.childIds)) {
          item.childIds.forEach((child) => {
            if (child && !childrenMap.has(child._id.toString())) {
              childrenMap.set(child._id.toString(), {
                id: child._id,
                fullName: child.fullName,
                profileImage: child.profileImage || "",
                isOnline: child.isOnline,
                role: child.role || "child",
                lastActive: child.lastActive ?? null,
              });
            }
          });
        }
      });

      const children = Array.from(childrenMap.values());

      return res.status(200).json({
        success: true,
        count: children.length,
        data: children,
      });
    }

    const assignments = await TherapistAssignment.find({
      childIds: targetId,
    })
      .populate({
        path: "therapistId",
        select: "_id fullName profileImage isOnline lastActive role",
      })
      .lean();

    const therapists = assignments
      .filter((item) => item.therapistId)
      .map((item) => ({
        id: item.therapistId._id,
        fullName: item.therapistId.fullName,
        profileImage: item.therapistId.profileImage || "",
        isOnline: item.therapistId.isOnline,
        role: item.therapistId.role || "therapist",
        lastActive: item.therapistId.lastActive ?? null,
        specialty: item.specialty || "",
      }));

    return res.status(200).json({
      success: true,
      count: therapists.length,
      data: therapists,
    });
  } catch (error) {
    console.error("getAssignMembers error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAssignTherapist = async (req, res) => {
  try {
    const rawChildId = req.user?._id || req.user?.id;

    if (!rawChildId) {
      return res.status(400).json({
        success: false,
        message: "Child ID is required.",
      });
    }

    const childId = new mongoose.Types.ObjectId(rawChildId);

    const assignments = await TherapistAssignment.find({ childIds: childId })
      .populate({
        path: "therapistId",
        select: "fullName email",
      })
      .lean();

    if (!assignments || assignments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No therapists assigned for this child.",
      });
    }

    const therapists = assignments
      .filter((item) => item.therapistId)
      .map((item) => ({
        _id: item.therapistId._id,
        name: item.therapistId.fullName,
        email: item.therapistId.email,
        specialty: item.specialty,
      }));

    return res.status(200).json({
      success: true,
      data: therapists,
    });
  } catch (error) {
    console.error("Error fetching assigned therapists:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned therapists.",
      error: error.message,
    });
  }
};

exports.getCNICRegisterSameUser = async (req, res) => {
  try {
    const { cnic } = req.params;
    const currentUserId = req.user?._id || req.user?.id;

    if (!cnic) {
      return res.status(400).json({
        success: false,
        message: "CNIC is required",
      });
    }

    const users = await User.find({
      fatherCnic: cnic,
      _id: { $ne: currentUserId },
    }).select(
      "_id fullName email phone role permissions profileImage age fatherCnic",
    );

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("getCNICRegisterSameUser error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getChildUpcomingSessions = async (req, res) => {
  try {
    const childId = req.user?._id || req.user?.id;

    if (!childId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const now = new Date();

    const schedules = await Scheduling.find({
      "appointments.children.childId": childId,
    })
      .populate(
        "therapistId",
        "fullName email role profileImage",
      )
      .lean();

    const therapistIds = schedules
      .map((schedule) =>
        schedule.therapistId?._id
        || schedule.therapistId
      )
      .filter(Boolean);

    const assignments = await TherapistAssignment.find({
      therapistId: {
        $in: therapistIds,
      },
      childIds: childId,
    })
      .select("therapistId specialty")
      .lean();

    const specialtyMap = new Map();

    assignments.forEach((assignment) => {
      specialtyMap.set(
        String(assignment.therapistId),
        assignment.specialty || "",
      );
    });

    const buildDateTime = (date, time) => {
      if (!date) {
        return null;
      }

      const value = new Date(date);

      if (Number.isNaN(value.getTime())) {
        return null;
      }

      const timeValue = String(time || "").trim();

      const match = timeValue.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
      );

      if (!match) {
        return value;
      }

      value.setHours(
        Number(match[1]),
        Number(match[2]),
        Number(match[3] || 0),
        0,
      );

      return value;
    };

    const upcomingSessions = [];

    schedules.forEach((schedule) => {
      const therapist = schedule.therapistId;

      const therapistId = therapist?._id
        ? String(therapist._id)
        : String(therapist || "");

      const specialty = specialtyMap.get(therapistId) || "";

      (schedule.appointments || []).forEach(
        (appointment) => {
          const childEntry = (
            appointment.children || []
          ).find(
            (child) =>
              child?.childId
              && String(child.childId)
                === String(childId),
          );

          if (!childEntry) {
            return;
          }

          const sessionDateTime = buildDateTime(
            appointment.date,
            appointment.startTime,
          );

          if (!sessionDateTime) {
            return;
          }

          if (
            sessionDateTime.getTime()
              <= now.getTime()
          ) {
            return;
          }

          upcomingSessions.push({
            appointmentId: String(
              appointment._id,
            ),
            therapistId,
            therapistName: therapist?.fullName
              || "Therapist",
            therapistImage: therapist?.profileImage
              || "",
            specialty,
            date: appointment.date,
            startTime: appointment.startTime
              || "--:--",
            endTime: appointment.endTime
              || "--:--",
            sessionType: appointment.sessionType
              || "regular",
            type: appointment.type
              || null,
            attendanceStatus: childEntry.attendance_status
              || "Pending",
            sessionDateTime,
          });
        },
      );
    });

    upcomingSessions.sort(
      (a, b) =>
        new Date(a.sessionDateTime)
        - new Date(b.sessionDateTime),
    );

    const totalUpcoming = upcomingSessions.length;

    const nextSessions = upcomingSessions
      .slice(0, 2)
      .map((session) => {
        const {
          sessionDateTime,
          ...item
        } = session;

        return item;
      });

    return res.status(200).json({
      success: true,
      totalUpcoming,
      count: nextSessions.length,
      data: nextSessions,
    });
  } catch (error) {
    console.error(
      "getChildUpcomingSessions error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming sessions",
      error: error.message,
    });
  }
};
const ALLOWED_USER_ROLES = [
  "Child",
  "Therapist",
];
const getUserId = (req) => req.user?._id || req.user?.id;

const checkUserRole = (role) => ALLOWED_USER_ROLES.includes(role);

exports.createComplaint = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }
    if (!checkUserRole(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only Child or Therapist can create complaints.",
      });
    }

    const {
      title,
      description,
      priority = "Normal",
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Complaint title is required.",
      });
    }

    if (!description?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Complaint description is required.",
      });
    }

    if (title.trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: "Title cannot exceed 120 characters.",
      });
    }

    if (
      description.trim().length > 2000
    ) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 2000 characters.",
      });
    }

    if (
      !["Normal", "High"].includes(
        priority,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority.",
      });
    }

    const complaint = await Complaint.create({
      complainantId: userId,
      complainantRole: userRole,
      title: title.trim(),
      description: description.trim(),
      priority,
      status: "Pending",
      messages: [],
    });

    return res.status(201).json({
      success: true,
      message: "Complaint submitted successfully.",
      data: complaint,
    });
  } catch (error) {
    console.error(
      "createComplaint:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create complaint.",
    });
  }
};

exports.getMyComplaints = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!checkUserRole(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1,
    );

    const limit = 5;

    const skip = (page - 1) * limit;

    const query = {
      complainantId: userId,
    };

    if (
      ["Pending", "Resolved"].includes(
        req.query.status,
      )
    ) {
      query.status = req.query.status;
    }

    const [
      complaints,
      total,
    ] = await Promise.all([
      Complaint.find(query)
        .select(
          [
            "title",
            "description",
            "status",
            "priority",
            "messages",
            "resolvedAt",
            "resolutionNote",
            "createdAt",
            "updatedAt",
          ].join(" "),
        )
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Complaint.countDocuments(
        query,
      ),
    ]);

    const data = complaints.map(
      (complaint) => {
        const messages = complaint.messages || [];

        const lastMessage = messages.length > 0
          ? messages[
            messages.length - 1
          ]
          : null;

        return {
          _id: complaint._id,
          title: complaint.title,
          description: complaint.description,
          status: complaint.status,
          priority: complaint.priority,
          createdAt: complaint.createdAt,
          updatedAt: complaint.updatedAt,
          resolvedAt: complaint.resolvedAt,
          resolutionNote: complaint.resolutionNote,
          messageCount: messages.length,
          lastMessage: lastMessage
            ? {
              text: lastMessage.text,
              senderRole: lastMessage.senderRole,
              createdAt: lastMessage.createdAt,
            }
            : null,
        };
      },
    );

    const totalPages = Math.ceil(
      total / limit,
    );

    const hasMore = page < totalPages;

    return res.status(200).json({
      success: true,
      page,
      limit,
      count: data.length,
      total,
      totalPages,
      hasMore,
      nextPage: hasMore
        ? page + 1
        : null,

      data,
    });
  } catch (error) {
    console.error(
      "getMyComplaints:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints.",
    });
  }
};

exports.getComplaintById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!checkUserRole(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const {
      complaintId,
    } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        complaintId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID.",
      });
    }

    const complaint = await Complaint.findOne({
      _id: complaintId,
      complainantId: userId,
    })
      .populate(
        "complainantId",
        "fullName profileImage role",
      )
      .populate(
        "messages.senderId",
        "fullName profileImage role",
      )
      .populate(
        "resolvedBy",
        "fullName profileImage role",
      )
      .lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    console.error(
      "getComplaintById:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaint.",
    });
  }
};

exports.replyComplaint = async (req, res) => {
  try {
    const userId = getUserId(req);
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!checkUserRole(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const {
      complaintId,
    } = req.params;

    const {
      text,
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(
        complaintId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID.",
      });
    }

    if (!text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required.",
      });
    }

    if (
      text.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Reply cannot exceed 1000 characters.",
      });
    }

    const complaint = await Complaint.findOne({
      _id: complaintId,
      complainantId: userId,
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    complaint.messages.push({
      senderId: userId,
      senderRole: userRole,
      text: text.trim(),
      readByRecipient: false,
    });

    await complaint.save();

    const newMessage = complaint.messages[
      complaint.messages.length - 1
    ];

    return res.status(200).json({
      success: true,
      message: "Reply sent successfully.",
      data: newMessage,
    });
  } catch (error) {
    console.error(
      "replyComplaint:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to send reply.",
    });
  }
};
