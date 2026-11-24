const { default: mongoose } = require("mongoose");
const TherapistAssignment = require("../models/TherapistAssignment");
const User = require("../models/User");
const Service = require("../models/Service");
const TherapistAvailability = require("../models/TherapistAvailability");
const Scheduling = require("../models/Scheduling");
const LeaveRequest = require("../models/LeaveRequest");
const SystemSetting = require("../models/SystemSetting");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SESSION_TIMES = [30, 45, 60, 90, 120];
const DAY_MS = 86400000;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const JS_DAY_TO_NAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_STEP = 15;
const INACTIVE_TYPES = ["cancel", "postponed"];
const LEAVE_MSG = "Therapist is on leave on this day.";
const RANGE_DAYS = { week: 7, month: 30 };

const pad = (n) => String(n).padStart(2, "0");

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const minutesToTime = (minutes) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const dateKeyOf = (d) => new Date(d).toISOString().slice(0, 10);
const utcMidnight = (key) => new Date(`${key}T00:00:00Z`);
const addDays = (key, n) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);

const isValidDate = (s) =>
  typeof s === "string" &&
  DATE_REGEX.test(s) &&
  !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

const weekdayOf = (s) => JS_DAY_TO_NAME[new Date(`${s}T00:00:00Z`).getUTCDay()];

const todayKey = (tz = "Asia/Karachi") =>
  new Date().toLocaleDateString("en-CA", { timeZone: tz });

const clockMinutes = (tz) => {
  const hhmm = new Date().toLocaleTimeString("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return toMin(hhmm);
};

let settingsCache = { at: 0, value: null };
const loadScheduleSettings = async () => {
  if (settingsCache.value && Date.now() - settingsCache.at < 60 * 1000) {
    return settingsCache.value;
  }
  const s = await SystemSetting.findOne().lean();
  const value = {
    tz: s?.timezone || "Asia/Karachi",
    clinicStart: s?.clinicStartTime ? toMin(s.clinicStartTime) : null,
    clinicEnd: s?.clinicEndTime ? toMin(s.clinicEndTime) : null,
    workingDays: s?.workingDays?.length ? s.workingDays : WORKING_DAYS,
  };
  settingsCache = { at: Date.now(), value };
  return value;
};

const insideClinic = (a, b, st) =>
  st.clinicStart == null || (a >= st.clinicStart && b <= st.clinicEnd);

const loadTherapistLeaves = async (therapistId, from, to) => {
  const docs = await LeaveRequest.find({
    applicantId: therapistId,
    status: "approved",
    startDate: { $lt: utcMidnight(addDays(to, 1)) },
    endDate: { $gte: utcMidnight(from) },
  })
    .select("startDate endDate")
    .lean();

  return docs.map((d) => ({
    from: dateKeyOf(d.startDate),
    to: dateKeyOf(d.endDate),
  }));
};
const onLeave = (leaves, date) =>
  leaves.some((l) => l.from <= date && date <= l.to);

const computeFreeSlots = async ({
  therapistId,
  childIds = [],
  date,
  minutes,
  minDate = null,
  maxDate = null,
  step = SLOT_STEP,
  includeBooked = false,
}) => {
  const st = await loadScheduleSettings();
  const today = todayKey(st.tz);

  if (!isValidDate(date)) return { error: "A valid date is required." };
  if (date < today) return { error: "Date cannot be in the past." };
  if ((minDate && date < minDate) || (maxDate && date > maxDate)) {
    return { error: "Date must be within the batch period." };
  }

  const day = weekdayOf(date);
  if (!st.workingDays.includes(day)) {
    return { slots: [], reason: `${day} is not a clinic working day.` };
  }
  const leaves = await loadTherapistLeaves(therapistId, date, date);
  if (onLeave(leaves, date)) {
    return { slots: [], onLeave: true, reason: LEAVE_MSG };
  }

  const children = childIds.map(String);
  const childObjIds = children.map((id) => new mongoose.Types.ObjectId(id));
  const therapistObjId = new mongoose.Types.ObjectId(therapistId);
  const dayStart = utcMidnight(date);
  const [year, month] = date.split("-").map(Number);

  const [rules, rows] = await Promise.all([
    TherapistAvailability.find({ therapistId, isActive: true }).lean(),
    Scheduling.aggregate([
      {
        $match: {
          $or: [
            { therapistId: therapistObjId, year, month },
            ...(childObjIds.length
              ? [
                  {
                    appointments: {
                      $elemMatch: {
                        date: dayStart,
                        "children.childId": { $in: childObjIds },
                      },
                    },
                  },
                ]
              : []),
          ],
        },
      },
      {
        $project: {
          therapistId: 1,
          appointments: {
            $filter: {
              input: "$appointments",
              as: "a",
              cond: { $eq: ["$$a.date", dayStart] },
            },
          },
        },
      },
      { $unwind: "$appointments" },
      {
        $project: {
          _id: 0,
          mine: { $eq: ["$therapistId", therapistObjId] },
          sessionType: "$appointments.sessionType",
          startTime: "$appointments.startTime",
          endTime: "$appointments.endTime",
          childIds: "$appointments.children.childId",
        },
      },
    ]),
  ]);

  const busy = [];
  for (const ap of rows) {
    if (INACTIVE_TYPES.includes(ap.sessionType)) continue;
    const hasChild = (ap.childIds || []).some((c) => children.includes(String(c)));
    if (ap.mine || hasChild) {
      busy.push({ a: toMin(ap.startTime), b: toMin(ap.endTime) });
    }
  }

  let nowMin = -1;
  if (date === today) nowMin = clockMinutes(st.tz);

  const slots = [];
  const seen = new Set();

  for (const r of rules) {
    let windows;
    if (r.type === "custom") {
      if (r.date !== date) continue;
      windows = [r];
    } else {
      if ((r.effectiveFrom && date < r.effectiveFrom) || (r.effectiveTo && date > r.effectiveTo)) {
        continue;
      }
      windows = (r.slots || []).filter((s) => s.day === day);
    }

    for (const w of windows) {
      for (let a = toMin(w.startTime); a + minutes <= toMin(w.endTime); a += step) {
        const b = a + minutes;
        if (seen.has(a)) continue;
        if (a <= nowMin) continue;
        if (!insideClinic(a, b, st)) continue;

        const isBusy = busy.some((x) => x.a < b && a < x.b);
        if (isBusy && !includeBooked) continue;

        seen.add(a);
        slots.push({
          startTime: minutesToTime(a),
          endTime: minutesToTime(b),
          ...(includeBooked && { booked: isBusy }),
        });
      }
    }
  }

  slots.sort((x, y) => x.startTime.localeCompare(y.startTime));

  return {
    slots,
    reason: !slots.length
      ? "No free time on this date. Try another day."
      : includeBooked && slots.every((s) => s.booked)
        ? "All times on this date are booked."
        : "",
  };
};



exports.getDoctorPublic = async (req, res) => {
  try {
    const { specialties } = req.body;

    if (
      !specialties ||
      (Array.isArray(specialties) && !specialties.length)
    ) {
      return res.status(400).json({
        success: false,
        message: "Specialties are required.",
      });
    }

    const specialtyList = (
      Array.isArray(specialties) ? specialties : [specialties]
    )
      .map((s) => String(s).trim())
      .filter(Boolean);

    if (!specialtyList.length || specialtyList.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Invalid specialties.",
      });
    }

    const services = await Service.find({
      $or: specialtyList.map((s) => ({
        label: {
          $regex: `^${escapeRegex(s)}$`,
          $options: "i",
        },
      })),
    })
      .select("_id label")
      .lean();

    const serviceIds = services.map((s) => s._id);

    const assignments = serviceIds.length
      ? await TherapistAssignment.find({
          specialty: { $in: serviceIds },
        })
          .select("therapistId specialty")
          .lean()
      : [];

    const therapistIds = [
      ...new Set(assignments.map((a) => String(a.therapistId))),
    ];

    const therapists = therapistIds.length
      ? await User.find({
          _id: { $in: therapistIds },
          role: "Therapist",
          isActive: true,
        })
          .select("_id fullName")
          .lean()
      : [];

    const therapistMap = new Map(
      therapists.map((t) => [
        String(t._id),
        {
          therapistId: t._id,
          name: t.fullName,
        },
      ])
    );

    const serviceMap = new Map(
      services.map((s) => [s.label.toLowerCase(), s])
    );

    const result = specialtyList.map((specialtyName) => {
      const service = serviceMap.get(specialtyName.toLowerCase());

      if (!service) {
        return {
          specialtyId: null,
          specialty: specialtyName,
          doctors: [],
        };
      }

      const doctors = assignments
        .filter(
          (a) => String(a.specialty) === String(service._id)
        )
        .map((a) => therapistMap.get(String(a.therapistId)))
        .filter(Boolean);

      return {
        specialtyId: service._id,
        specialty: service.label,
        doctors: [
          ...new Map(
            doctors.map((doctor) => [
              String(doctor.therapistId),
              doctor,
            ])
          ).values(),
        ],
      };
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getDoctorPublic:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctors.",
    });
  }
};

exports.getServicesPublic = async (req, res) => {
  try {
    const services = await Service.find().select("label").lean();

    return res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("getServices:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services.",
    });
  }
};

exports.getTherapistAvailableSlots = async (req, res) => {
  try {
    const { therapistId, date, range } = req.body;
    const childId = req.body.childId ?? null;
    const minutes = Number(req.body.sessionMinutes?? 60);

    if (!mongoose.isValidObjectId(therapistId)) {
      return res.status(400).json({ success: false, message: "Select a therapist." });
    }
    if (childId !== null && !mongoose.isValidObjectId(childId)) {
      return res.status(400).json({ success: false, message: "Invalid child." });
    }
    if (!SESSION_TIMES.includes(minutes)) {
      return res.status(400).json({
        success: false,
        message: "Session time must be 30, 45, 60, 90 or 120 minutes.",
      });
    }
    if (range !== undefined && !RANGE_DAYS[range]) {
      return res.status(400).json({
        success: false,
        message: 'range must be "week" or "month".',
      });
    }

    const therapist = await User.findOne({
      _id: therapistId,
      role: "Therapist",
      isActive: true,
    })
      .select("_id fullName")
      .lean();

    if (!therapist) {
      return res.status(404).json({ success: false, message: "Therapist not found." });
    }

    if (childId) {
      const child = await loadChild(childId);
      if (!child) {
        return res.status(404).json({ success: false, message: "Child not found." });
      }
    }

    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);

    let dates;
    if (date) {
      if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "A valid date is required." });
      }
      dates = [date];
    } else {
      const total = RANGE_DAYS[range || "week"];
      dates = Array.from({ length: total }, (_, i) => addDays(today, i));
    }

    const results = await Promise.all(
      dates.map(async (d) => ({
        date: d,
        r: await computeFreeSlots({
          therapistId,
          childIds: childId ? [childId] : [],
          date: d,
          minutes,
          step: minutes,
          includeBooked: false,
        }),
      })),
    );

    if (date) {
      const { r } = results[0];
      if (r.error) {
        return res.status(400).json({ success: false, message: r.error });
      }
      return res.status(200).json({
        success: true,
        data: {
          therapist: { therapistId: therapist._id, name: therapist.fullName },
          sessionMinutes: minutes,
          days: [{ date, weekday: weekdayOf(date), slots: r.slots, reason: r.reason, onLeave: !!r.onLeave }],
        },
      });
    }

    const days = results
      .filter(({ r }) => !r.error && r.slots?.length)
      .map(({ date: d, r }) => ({
        date: d,
        weekday: weekdayOf(d),
        slots: r.slots,
      }));

    return res.status(200).json({
      success: true,
      data: {
        therapist: { therapistId: therapist._id, name: therapist.fullName },
        sessionMinutes: minutes,
        from: dates[0],
        to: dates[dates.length - 1],
        days,
      },
    });
  } catch (error) {
    console.error("getTherapistAvailableSlots:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load available slots.",
    });
  }
};