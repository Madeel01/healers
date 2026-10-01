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
const TherapistAvailability = require("../models/TherapistAvailability");
const BatchAssignment = require("../models/BatchAssignment");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const POPULATE = [
  { path: "complainantId", select: "fullName role" },
  { path: "resolvedBy", select: "fullName" },
];
const normalizeName = (name) => name?.trim().replace(/\s+/g, " ").toLowerCase();
const normalizeCnic = (v = "") => {
  const d = String(v).replace(/\D/g, "");
  return d.length === 13
    ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`
    : null;
};
const SESSION_TIMES = [45, 60, 90, 120];
const DAY_MS = 86400000;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const JS_DAY_TO_NAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const to12 = (t) => {
  const [h, m = 0] = String(t).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

const isValidDate = (s) =>
  typeof s === "string" &&
  DATE_REGEX.test(s) &&
  !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

const weekdayOf = (s) => JS_DAY_TO_NAME[new Date(`${s}T00:00:00Z`).getUTCDay()];

const todayKey = (tz = "Asia/Karachi") =>
  new Date().toLocaleDateString("en-CA", { timeZone: tz });

const describe = (r) =>
  r.type === "custom"
    ? `${r.date}, ${to12(r.startTime)}-${to12(r.endTime)}`
    : (r.slots || [])
      .map((s) => `${s.day} ${to12(s.startTime)}-${to12(s.endTime)}`)
      .join(", ");

const timesOverlap = (a, b) =>
  toMin(a.startTime) < toMin(b.endTime) &&
  toMin(b.startTime) < toMin(a.endTime);

const rulesConflict = (a, b) => {
  if (a.type === "custom" && b.type === "custom") {
    return a.date === b.date && timesOverlap(a, b);
  }
  if (a.type === "custom" || b.type === "custom") {
    const c = a.type === "custom" ? a : b;
    const r = a.type === "custom" ? b : a;
    const day = weekdayOf(c.date);
    const inRange =
      (!r.effectiveFrom || c.date >= r.effectiveFrom) &&
      (!r.effectiveTo || c.date <= r.effectiveTo);
    return (
      inRange &&
      (r.slots || []).some((s) => s.day === day && timesOverlap(s, c))
    );
  }
  const rangesOverlap =
    (!a.effectiveTo || !b.effectiveFrom || a.effectiveTo >= b.effectiveFrom) &&
    (!b.effectiveTo || !a.effectiveFrom || b.effectiveTo >= a.effectiveFrom);
  return (
    rangesOverlap &&
    (a.slots || []).some((sa) =>
      (b.slots || []).some((sb) => sa.day === sb.day && timesOverlap(sa, sb)),
    )
  );
};

const buildRule = async (body, current) => {
  const settings = await SystemSetting.findOne().lean();
  const today = todayKey(settings?.timezone || "Asia/Karachi");

  const type = current ? current.type : body.type;
  if (!["recurring", "custom"].includes(type)) {
    return { error: "type must be recurring or custom." };
  }

  const checkTimes = (startTime, endTime, label = "") => {
    const prefix = label ? `${label}: ` : "";
    if (!TIME_REGEX.test(startTime || "") || !TIME_REGEX.test(endTime || "")) {
      return `${prefix}startTime and endTime must be in HH:mm format.`;
    }
    if (toMin(endTime) <= toMin(startTime)) {
      return `${prefix}End time must be after start time.`;
    }
    if (
      settings &&
      (toMin(startTime) < toMin(settings.clinicStartTime) ||
        toMin(endTime) > toMin(settings.clinicEndTime))
    ) {
      return `${prefix}Availability must be within clinic hours (${to12(settings.clinicStartTime)}-${to12(settings.clinicEndTime)}).`;
    }
    return null;
  };

  if (type === "recurring") {
    const raw = body.slots !== undefined ? body.slots : current?.slots;
    if (!Array.isArray(raw) || raw.length === 0) {
      return { error: "Select at least one day." };
    }

    const seen = new Set();
    const slots = [];
    for (const s of raw) {
      if (!WORKING_DAYS.includes(s?.day)) return { error: "Invalid weekday." };
      if (seen.has(s.day))
        return { error: `${s.day} is added more than once.` };
      seen.add(s.day);

      if (
        settings?.workingDays?.length &&
        !settings.workingDays.includes(s.day)
      ) {
        return { error: `${s.day} is not a clinic working day.` };
      }
      const err = checkTimes(s.startTime, s.endTime, s.day);
      if (err) return { error: err };

      slots.push({ day: s.day, startTime: s.startTime, endTime: s.endTime });
    }
    slots.sort(
      (a, b) => WORKING_DAYS.indexOf(a.day) - WORKING_DAYS.indexOf(b.day),
    );
    const effectiveFrom = body.effectiveFrom || current?.effectiveFrom || today;
    const effectiveTo =
      body.effectiveTo !== undefined ? body.effectiveTo : current?.effectiveTo;

    if (!isValidDate(effectiveFrom)) return { error: "Invalid start date." };
    if (effectiveTo && !isValidDate(effectiveTo))
      return { error: "Invalid end date." };
    if (effectiveTo && effectiveTo < effectiveFrom) {
      return { error: "End date cannot be before start date." };
    }
    return {
      rule: {
        type,
        slots,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        date: null,
        startTime: null,
        endTime: null,
      },
    };
  }

  const date = body.date !== undefined ? body.date : current?.date;
  const startTime =
    body.startTime !== undefined ? body.startTime : current?.startTime;
  const endTime = body.endTime !== undefined ? body.endTime : current?.endTime;

  if (!isValidDate(date)) return { error: "A valid date is required." };
  if (date < today) return { error: "Date cannot be in the past." };
  if (
    settings?.workingDays?.length &&
    !settings.workingDays.includes(weekdayOf(date))
  ) {
    return { error: `${weekdayOf(date)} is not a clinic working day.` };
  }
  const err = checkTimes(startTime, endTime);
  if (err) return { error: err };

  return {
    rule: {
      type,
      date,
      startTime,
      endTime,
      slots: [],
      effectiveFrom: null,
      effectiveTo: null,
    },
  };
};

const findConflict = async (therapistId, rule, excludeId) => {
  const query = { therapistId, isActive: true };
  if (excludeId) query._id = { $ne: excludeId };
  const others = await TherapistAvailability.find(query).lean();
  return others.find((o) => rulesConflict(rule, o));
};

const settingsToMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const validateSettingsPayload = (body, current, { partial = false } = {}) => {
  const errors = [];
  const out = {};

  for (const field of [
    "clinicStartTime",
    "clinicEndTime",
    "breakStartTime",
    "breakEndTime",
  ]) {
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
    if (
      !Array.isArray(body.workingDays) ||
      body.workingDays.some((d) => !WORKING_DAYS.includes(d))
    ) {
      errors.push(
        `workingDays must be an array using: ${WORKING_DAYS.join(", ")}.`,
      );
    } else {
      out.workingDays = body.workingDays;
    }
  }

  for (const field of ["clinicName", "address", "phone", "timezone"]) {
    if (body[field] !== undefined) out[field] = String(body[field]).trim();
  }
  if (body.email !== undefined)
    out.email = String(body.email).trim().toLowerCase();

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
      start &&
      end &&
      (settingsToMinutes(breakStart) < settingsToMinutes(start) ||
        settingsToMinutes(breakEnd) > settingsToMinutes(end))
    ) {
      errors.push("Break time must fall within clinic working hours.");
    }
  }

  return { errors, data: out };
};
const pad = (n) => String(n).padStart(2, "0");

const formatDate = (date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
};

const getDayName = (date) => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[date.getDay()];
};

const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${pad(h)}:${pad(m)}`;
};

const overlaps = (startA, endA, startB, endB) => {
  return (
    timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(endA) > timeToMinutes(startB)
  );
};

const dateKeyOf = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (key, n) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);
const utcMidnight = (key) => new Date(`${key}T00:00:00Z`);
const loadScheduleSettings = async () => {
  const s = await SystemSetting.findOne().lean();
  return {
    tz: s?.timezone || "Asia/Karachi",
    clinicStart: s?.clinicStartTime ? toMin(s.clinicStartTime) : null,
    clinicEnd: s?.clinicEndTime ? toMin(s.clinicEndTime) : null,
    breakStart: s?.breakStartTime ? toMin(s.breakStartTime) : null,
    breakEnd: s?.breakEndTime ? toMin(s.breakEndTime) : null,
    workingDays: s?.workingDays?.length ? s.workingDays : WORKING_DAYS,
  };
};

const planRange = (batch, today) => {
  const from = dateKeyOf(batch.dateFrom);
  return { from: from > today ? from : today, to: dateKeyOf(batch.dateTo) };
};

const insideClinic = (a, b, st) =>
  (st.clinicStart == null || (a >= st.clinicStart && b <= st.clinicEnd)) &&
  !(st.breakStart != null && a < st.breakEnd && st.breakStart < b);

const availableOnDate = (rules, key, a, b) => {
  const day = weekdayOf(key);
  return rules.some((r) => {
    if (r.type === "custom") {
      return r.date === key && toMin(r.startTime) <= a && toMin(r.endTime) >= b;
    }
    if (
      (r.effectiveFrom && key < r.effectiveFrom) ||
      (r.effectiveTo && key > r.effectiveTo)
    ) {
      return false;
    }
    return (r.slots || []).some(
      (s) => s.day === day && toMin(s.startTime) <= a && toMin(s.endTime) >= b,
    );
  });
};

const weeklyOptions = (rules, from, to, minutes, st) => {
  const out = {};
  WORKING_DAYS.forEach((d) => (out[d] = []));
  const seen = new Set();

  for (const r of rules) {
    if (r.type !== "recurring") continue;
    if (
      (r.effectiveTo && r.effectiveTo < from) ||
      (r.effectiveFrom && r.effectiveFrom > to)
    )
      continue;

    for (const s of r.slots || []) {
      if (!st.workingDays.includes(s.day)) continue;
      for (
        let a = toMin(s.startTime);
        a + minutes <= toMin(s.endTime);
        a += minutes
      ) {
        const b = a + minutes;
        if (!insideClinic(a, b, st)) continue;
        const k = `${s.day}|${a}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out[s.day].push({
          startTime: minutesToTime(a),
          endTime: minutesToTime(b),
        });
      }
    }
  }
  Object.values(out).forEach((l) =>
    l.sort((x, y) => x.startTime.localeCompare(y.startTime)),
  );
  return out;
};
const analyzePlan = async (batch, body) => {
  const minutes = Number(body.sessionMinutes);

  if (!SESSION_TIMES.includes(minutes)) {
    return { error: "Session time must be 45, 60, 90 or 120 minutes." };
  }

  const plans = Array.isArray(body.plans) ? body.plans : [];

  if (!plans.length) {
    return { error: "Select at least one therapist and slot." };
  }

  // Validate plans
  const seenPlan = new Set();

  for (const p of plans) {
    if (!mongoose.isValidObjectId(p.therapistId)) {
      return { error: "Invalid therapist." };
    }

    if (!batch.speciality.includes(p.speciality)) {
      return { error: "That speciality does not belong to this batch." };
    }

    const key = `${p.therapistId}|${p.speciality}`;

    if (seenPlan.has(key)) {
      return {
        error: "A therapist is listed twice for the same speciality.",
      };
    }

    seenPlan.add(key);

    if (!Array.isArray(p.slots) || !p.slots.length) {
      return {
        error: "Every selected therapist needs at least one slot.",
      };
    }

    for (const s of p.slots) {
      if (
        !WORKING_DAYS.includes(s.day) ||
        !TIME_REGEX.test(s.startTime || "") ||
        !TIME_REGEX.test(s.endTime || "") ||
        toMin(s.endTime) - toMin(s.startTime) !== minutes
      ) {
        return { error: "One of the selected slots is invalid." };
      }
    }
  }

  const therapistIds = [
    ...new Set(plans.map((p) => String(p.therapistId))),
  ];

  // Verify therapist speciality eligibility
  const eligible = await TherapistAssignment.find({
    therapistId: { $in: therapistIds },
    specialty: { $in: batch.speciality },
  }).lean();

  const notEligible = plans.find(
    (p) =>
      !eligible.some(
        (e) =>
          String(e.therapistId) === String(p.therapistId) &&
          e.specialty === p.speciality,
      ),
  );

  if (notEligible) {
    return {
      error: "A selected therapist does not match the batch speciality.",
    };
  }

  const st = await loadScheduleSettings();
  const today = todayKey(st.tz);
  const { from, to } = planRange(batch, today);

  if (from > to) {
    return { error: "This batch has already ended." };
  }

  // Load everything needed in parallel
  const [rules, users, batchAssignments, schedules] = await Promise.all([
    TherapistAvailability.find({
      therapistId: { $in: therapistIds },
      isActive: true,
    }).lean(),

    User.find(
      {
        _id: { $in: therapistIds },
        role: "Therapist",
      },
      "fullName",
    ).lean(),

    BatchAssignment.find({
      batchId: batch._id,
      therapistId: { $in: therapistIds },
      speciality: { $in: batch.speciality },
    }).lean(),

    Scheduling.find({
      therapistId: { $in: therapistIds },
      "appointments.date": {
        $gte: utcMidnight(from),
        $lte: utcMidnight(to),
      },
    })
      .populate("therapistId", "fullName")
      .populate("appointments.children.childId", "fullName")
      .lean(),
  ]);

  const names = new Map(
    users.map((u) => [String(u._id), u.fullName]),
  );

  const rulesBy = new Map(
    therapistIds.map((id) => [
      id,
      rules.filter((r) => String(r.therapistId) === id),
    ]),
  );

  // Existing BatchAssignment sessions
  const batchSessionMap = new Map();

  for (const assignment of batchAssignments) {
    for (const session of assignment.sessions || []) {
      const key = [
        String(assignment.therapistId),
        assignment.speciality,
        session.date,
        session.startTime,
        session.endTime,
      ].join("|");

      batchSessionMap.set(key, String(session._id));
    }
  }

  // Expand weekly slots into actual dates
  const all = [];

  for (const p of plans) {
    const therapistId = String(p.therapistId);

    for (let date = from; date <= to; date = addDays(date, 1)) {
      const day = weekdayOf(date);

      for (const slot of p.slots) {
        if (slot.day !== day) continue;

        all.push({
          therapistId,
          therapistName: names.get(therapistId) || "",
          speciality: p.speciality,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    }
  }

  // Check availability
  const valid = [];
  const unavailable = [];

  for (const s of all) {
    const start = toMin(s.startTime);
    const end = toMin(s.endTime);

    const available =
      st.workingDays.includes(weekdayOf(s.date)) &&
      insideClinic(start, end, st) &&
      availableOnDate(
        rulesBy.get(s.therapistId) || [],
        s.date,
        start,
        end,
      );

    (available ? valid : unavailable).push(s);
  }

  // Prevent selected therapists from overlapping each other
  const byDate = {};

  for (const s of valid) {
    (byDate[s.date] ||= []).push(s);
  }

  for (const list of Object.values(byDate)) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];

        if (
          toMin(a.startTime) < toMin(b.endTime) &&
          toMin(b.startTime) < toMin(a.endTime)
        ) {
          return {
            error: `${a.therapistName} (${to12(a.startTime)}) and ${b.therapistName} (${to12(b.startTime)}) overlap on ${a.date}. Pick different times.`,
          };
        }
      }
    }
  }

  const children = (batch.childrenIds || []).map(String);

  // Existing appointments
  const busy = [];

  for (const sc of schedules) {
    for (const ap of sc.appointments || []) {
      busy.push({
        appointmentId: String(ap._id),
        therapistId: String(sc.therapistId?._id || sc.therapistId),
        therapistName:
          sc.therapistId?.fullName || "another therapist",

        children: (ap.children || []).map((child) => ({
          childId: String(child.childId?._id || child.childId),
          childName: child.childId?.fullName || "Child",
        })),

        date: dateKeyOf(ap.date),
        a: toMin(ap.startTime),
        b: toMin(ap.endTime),

        type: ap.type || null,
        batchId: ap.batchId ? String(ap.batchId) : null,
        batchAssignmentId: ap.batchAssignmentId
          ? String(ap.batchAssignmentId)
          : null,
        batchSessionId: ap.batchSessionId
          ? String(ap.batchSessionId)
          : null,
      });
    }
  }

  const conflicts = [];
  const duplicates = [];
  const toCreate = [];

  const range = (a, b) =>
    `${to12(minutesToTime(a))}-${to12(minutesToTime(b))}`;

  for (const s of valid) {
    const a = toMin(s.startTime);
    const b = toMin(s.endTime);

    const hits = busy.filter(
      (x) =>
        x.date === s.date &&
        x.a < b &&
        a < x.b,
    );

    const sessionKey = [
      s.therapistId,
      s.speciality,
      s.date,
      s.startTime,
      s.endTime,
    ].join("|");

    const batchSessionId = batchSessionMap.get(sessionKey);

    // Already created by this batch
    if (
      batchSessionId &&
      hits.some(
        (x) =>
          x.batchId === String(batch._id) &&
          x.batchSessionId === batchSessionId &&
          x.therapistId === s.therapistId &&
          x.a === a &&
          x.b === b,
      )
    ) {
      duplicates.push(s);
      continue;
    }

    const reasons = [];

    // Therapist already has another appointment
    const therapistConflict = hits.find(
      (x) => x.therapistId === s.therapistId,
    );

    if (therapistConflict) {
      reasons.push(
        `${s.therapistName} already has a session at ${range(
          therapistConflict.a,
          therapistConflict.b,
        )}`,
      );
    }

    // One of the batch children already has another appointment
    const childConflict = hits.find(
      (x) =>
        x.therapistId !== s.therapistId &&
        x.children?.some((child) =>
          children.includes(child.childId),
        ),
    );

    if (childConflict) {
      const child = childConflict.children.find((child) =>
        children.includes(child.childId),
      );

      reasons.push(
        `${child?.childName || "A batch child"} already has a session with ${childConflict.therapistName} (${range(
          childConflict.a,
          childConflict.b,
        )})`,
      );
    }

    if (reasons.length) {
      conflicts.push({
        ...s,
        reasons,
      });
    } else {
      toCreate.push(s);
    }
  }

  return {
    plans,
    minutes,
    names,
    children,
    valid,
    unavailable,
    conflicts,
    duplicates,
    toCreate,
  };
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
        { email: { $regex: search, $options: "i" } },
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
                $expr: { $eq: [{ $toObjectId: "$therapistId" }, "$$userId"] },
              },
            },
          ],
          as: "assignments",
        },
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
                in: { $size: { $ifNull: ["$$a.childIds", []] } },
              },
            },
          },
        },
      },
    ];

    if (specialty && specialty !== "All") {
      pipeline.push({
        $match: { specialties: specialty },
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
      specialties: specialties,
    });
  } catch (error) {
    console.log("Get Therapists Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get therapists",
      error: error.message,
    });
  }
};
exports.createTherapist = async (req, res) => {
  try {
    const { name, specialty, maxChildren, email, phone, address, password } =
      req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please enter a valid email address.",
        });
    }

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required." });
    }
    const phoneTrimmed = phone.trim();
    const phoneRegex = /^(030\d{8}|\+923\d{9})$/;
    if (!phoneRegex.test(phoneTrimmed)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be in 03011234567 or +923011234567 format.",
      });
    }
    const normalizedPhone = phoneTrimmed.startsWith("+92")
      ? "0" + phoneTrimmed.slice(3)
      : phoneTrimmed;

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and contain 1 lowercase, 1 uppercase, and 1 special character.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName: name,
      email,
      phone: normalizedPhone,
      address,
      role: "Therapist",
      password: hashedPassword,
      agreeTerms: true,
    });

    const assignment = await TherapistAssignment.create({
      therapistId: user._id,
      specialty: specialty || "",
      maxChildren:
        maxChildren && maxChildren > 0 ? parseInt(maxChildren, 10) : 15,
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
    const { name, specialty, maxChildren, email, phone, address, password } =
      req.body;

    const user = await User.findOne({ _id: id, role: "Therapist" });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Therapist not found." });
    }
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Please enter a valid email address.",
          });
      }

      const existingUser = await User.findOne({
        _id: { $ne: id },
        email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") },
      });
      if (existingUser) {
        return res
          .status(400)
          .json({
            success: false,
            message: "An account with this email already exists.",
          });
      }
      user.email = normalizedEmail;
    }
    if (phone) {
      const phoneTrimmed = phone.trim();
      const phoneRegex = /^(030\d{8}|\+923\d{9})$/;
      if (!phoneRegex.test(phoneTrimmed)) {
        return res.status(400).json({
          success: false,
          message:
            "Phone number must be in 03011234567 or +923011234567 format.",
        });
      }
      user.phone = phoneTrimmed.startsWith("+92")
        ? "0" + phoneTrimmed.slice(3)
        : phoneTrimmed;
    }
    if (password) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters and contain 1 lowercase, 1 uppercase, and 1 special character.",
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
      if (maxChildren !== undefined)
        assignment.maxChildren = parseInt(maxChildren, 10);
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
      return res
        .status(404)
        .json({ success: false, message: "Therapist not found." });
    }

    await TherapistAssignment.deleteOne({ therapistId: id });

    return res
      .status(200)
      .json({ success: true, message: "Therapist deleted." });
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
    const addChildIds = Array.isArray(req.body.addChildIds)
      ? req.body.addChildIds
      : [];
    const removeChildIds = Array.isArray(req.body.removeChildIds)
      ? req.body.removeChildIds
      : [];

    if (
      !therapistId ||
      (addChildIds.length === 0 && removeChildIds.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "therapistId and at least one of addChildIds/removeChildIds are required.",
      });
    }

    const uniqueAddIds = [...new Set(addChildIds.map((id) => id.toString()))];
    const uniqueRemoveIds = [
      ...new Set(removeChildIds.map((id) => id.toString())),
    ];

    const therapist = await User.findOne({
      _id: therapistId,
      role: "Therapist",
    });
    if (!therapist) {
      return res
        .status(404)
        .json({ success: false, message: "Therapist not found." });
    }

    let assignment = await TherapistAssignment.findOne({ therapistId });

    if (!assignment) {
      if (uniqueAddIds.length === 0) {
        return res.status(200).json({
          success: true,
          message:
            "Nothing to update — no existing assignment and no children to add.",
          data: {
            therapistId,
            currentLoad: 0,
            maxChildren: 0,
            addedIds: [],
            removedIds: [],
          },
        });
      }

      const maxChildren = therapist.maxChildren || 0;

      if (uniqueAddIds.length > maxChildren) {
        return res.status(400).json({
          success: false,
          message: `This therapist can have a maximum of ${maxChildren} children. You tried to assign ${uniqueAddIds.length}.`,
          data: {
            therapistId,
            requestedChildren: uniqueAddIds.length,
            maxChildren,
            availableSlots: maxChildren,
          },
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
    const notAssignedForRemoval = uniqueRemoveIds.filter(
      (id) => !existing.has(id),
    );

    const toAdd = uniqueAddIds.filter(
      (id) => !existing.has(id) && !toRemove.includes(id),
    );
    const alreadyAssignedIds = uniqueAddIds.filter(
      (id) => existing.has(id) && !toRemove.includes(id),
    );

    const currentLoad = assignment.childIds.length;
    const projectedLoad = currentLoad - toRemove.length + toAdd.length;

    if (projectedLoad > maxChildren) {
      const availableSlots = Math.max(
        maxChildren - (currentLoad - toRemove.length),
        0,
      );
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
        message:
          "No changes made — selected children already reflect the current state.",
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
      (c) => !toRemove.includes(c.toString()),
    );
    assignment.childIds.push(...toAdd);

    await assignment.save();

    const messageParts = [];
    if (toAdd.length > 0) messageParts.push(`${toAdd.length} child(ren) added`);
    if (toRemove.length > 0)
      messageParts.push(`${toRemove.length} child(ren) removed`);
    if (alreadyAssignedIds.length > 0)
      messageParts.push(`${alreadyAssignedIds.length} were already assigned`);
    if (notAssignedForRemoval.length > 0)
      messageParts.push(`${notAssignedForRemoval.length} were not assigned`);

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
    const { fullName, fatherName, fatherCnic, age, email, phone, password } =
      req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !password ||
      !fatherName ||
      !fatherCnic
    ) {
      return res.json({
        success: false,
        message:
          "fullName, email, phone, parent name, parent CNIC and password are required.",
      });
    }

    const cnic = normalizeCnic(fatherCnic);
    if (!cnic) {
      return res
        .status(400)
        .json({ success: false, message: "CNIC must be 13 digits." });
    }
    const existParent = await User.findOne({
      fatherCnic: cnic,
      role: "Child",
    }).lean();

    if (
      existParent &&
      normalizeName(existParent.fatherName) !== normalizeName(fatherName)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This parent CNIC already exists with a different parent name.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const child = await User.create({
      fullName,
      fatherName: fatherName,
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
    const { fullName, fatherName, fatherCnic, age, email, phone, password } =
      req.body;
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
            normalizeName(child.fatherName) !== normalizeName(fatherName),
        )
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This parent CNIC already exists with a different parent name.",
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
      { new: true, runValidators: true },
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
      { $pull: { childIds: id } },
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
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

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

    const [pendingCount, pendingSinceYesterday, onLeaveDocs] =
      await Promise.all([
        LeaveRequest.countDocuments({ status: "pending" }),
        LeaveRequest.countDocuments({
          status: "pending",
          createdAt: { $gte: yesterday },
        }),
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
    return res
      .status(200)
      .json({ success: true, data, totalCount: data.length });
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
      },
    ).lean();

    const feedbackMap = new Map(
      existingFeedbacks.map((feedback) => [
        feedback.appointmentId?.toString(),
        feedback,
      ]),
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
          !feedback || feedback.notes == null || feedback.notes.trim() === "";

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
              appointment._id.toString() === feedback.appointmentId?.toString(),
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
              appointment._id.toString() === feedback.appointmentId?.toString(),
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

      data.sort((a, b) => new Date(b.session.date) - new Date(a.session.date));
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
        { "appointments.$": 1 },
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
    return User.find(
      { role: { $in: ["Therapist", "Child", "Admin"] } },
      "_id",
    ).lean();
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
    const {
      title,
      message,
      audience,
      roles,
      users,
      deliverySchedule,
      sendAt,
      type,
    } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Title and message are required." });
    }
    const VALID_TYPES = [
      "System",
      "Appointment",
      "Therapy",
      "Message",
      "Reminder",
      "Alert",
      "General",
    ];
    const notifType = VALID_TYPES.includes(type) ? type : "General";
    if (!["all", "role", "users"].includes(audience)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid audience." });
    }

    let parsedRoles = [];
    let parsedUsers = [];
    try {
      parsedRoles = roles ? JSON.parse(roles) : [];
      parsedUsers = users ? JSON.parse(users) : [];
    } catch {
      return res
        .status(400)
        .json({
          success: false,
          message: "roles/users must be valid JSON arrays.",
        });
    }

    if (audience === "role" && parsedRoles.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Select at least one role (Therapist/Child).",
        });
    }
    if (audience === "users" && parsedUsers.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Select at least one user." });
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
        return res
          .status(400)
          .json({
            success: false,
            message: "sendAt is required for scheduled delivery.",
          });
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
      const recipientUsers = await resolveRecipients(
        audience,
        parsedRoles,
        parsedUsers,
      );
      notification.recipients = recipientUsers.map((u) => ({ user: u._id }));
      notification.status = "sent";
      notification.sentAt = new Date();
    }

    await notification.save();

    return res.status(201).json({
      success: true,
      message:
        status === "draft"
          ? "Draft saved."
          : status === "scheduled"
            ? "Broadcast scheduled."
            : "Broadcast sent.",
      data: notification,
    });
  } catch (error) {
    console.error("Create Broadcast Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to create broadcast.",
        error: error.message,
      });
  }
};
exports.getAllBroadcasts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      type = "",
    } = req.query;
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
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch broadcasts.",
        error: error.message,
      });
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
      return res
        .status(404)
        .json({ success: false, message: "Broadcast not found." });
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
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch broadcast.",
        error: error.message,
      });
  }
};
exports.updateBroadcast = async (req, res) => {
  try {
    const { broadcastId } = req.params;
    const {
      title,
      message,
      audience,
      type,
      roles,
      users,
      deliverySchedule,
      sendAt,
      removeAttachment,
    } = req.body;

    const broadcast = await Notification.findById(broadcastId);
    if (!broadcast) {
      return res
        .status(404)
        .json({ success: false, message: "Broadcast not found." });
    }
    if (broadcast.status === "sent") {
      return res
        .status(400)
        .json({ success: false, message: "Sent broadcasts can't be edited." });
    }

    if (title !== undefined) broadcast.title = title.trim();
    if (message !== undefined) broadcast.message = message.trim();
    if (type !== undefined) {
      const VALID_TYPES = [
        "System",
        "Appointment",
        "Therapy",
        "Message",
        "Reminder",
        "Alert",
        "General",
      ];
      broadcast.type = VALID_TYPES.includes(type) ? type : broadcast.type;
    }
    if (audience !== undefined) {
      if (!["all", "role", "users"].includes(audience)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid audience." });
      }
      let parsedRoles = [];
      let parsedUsers = [];
      try {
        parsedRoles = roles ? JSON.parse(roles) : [];
        parsedUsers = users ? JSON.parse(users) : [];
      } catch {
        return res
          .status(400)
          .json({
            success: false,
            message: "roles/users must be valid JSON arrays.",
          });
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
        return res
          .status(400)
          .json({
            success: false,
            message: "sendAt is required for scheduled delivery.",
          });
      }
      broadcast.status = "scheduled";
      broadcast.sendAt = new Date(sendAt);
    } else if (deliverySchedule === "draft") {
      broadcast.status = "draft";
      broadcast.sendAt = null;
    }

    // remove existing attachment if requested
    if (removeAttachment === "true" && broadcast.attachment?.url) {
      const oldPath = path.join(
        __dirname,
        "..",
        broadcast.attachment.url.replace(/^\//, ""),
      );
      fs.unlink(oldPath, () => { });
      broadcast.attachment = { url: null, name: null, type: null };
    }

    // replace attachment if a new file was uploaded
    if (req.file) {
      if (broadcast.attachment?.url) {
        const oldPath = path.join(
          __dirname,
          "..",
          broadcast.attachment.url.replace(/^\//, ""),
        );
        fs.unlink(oldPath, () => { });
      }
      broadcast.attachment = {
        url: `/assets/broadcasts/${req.file.filename}`,
        name: req.file.originalname,
        type: MIME_TO_TYPE[req.file.mimetype] || null,
      };
    }

    if (broadcast.status === "sending") {
      const recipientUsers = await resolveRecipients(
        broadcast.audience,
        broadcast.roles,
        broadcast.users,
      );
      broadcast.recipients = recipientUsers.map((u) => ({ user: u._id }));
      broadcast.status = "sent";
      broadcast.sentAt = new Date();
    }

    await broadcast.save();

    return res
      .status(200)
      .json({ success: true, message: "Broadcast updated.", data: broadcast });
  } catch (error) {
    console.error("Update Broadcast Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to update broadcast.",
        error: error.message,
      });
  }
};
exports.deleteBroadcast = async (req, res) => {
  try {
    const { broadcastId } = req.params;
    const broadcast = await Notification.findByIdAndDelete(broadcastId);
    if (!broadcast) {
      return res
        .status(404)
        .json({ success: false, message: "Broadcast not found." });
    }
    if (broadcast.attachment?.url) {
      const filePath = path.join(
        __dirname,
        "..",
        broadcast.attachment.url.replace(/^\//, ""),
      );
      fs.unlink(filePath, () => { }); // best-effort cleanup, no need to block response on it
    }
    return res
      .status(200)
      .json({ success: true, message: "Broadcast deleted." });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete broadcast.",
        error: error.message,
      });
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
      Complaint.countDocuments({
        status: "Pending",
        createdAt: { $gte: weekStart },
      }),
      Complaint.countDocuments({
        status: "Resolved",
        createdAt: { $gte: weekStart },
      }),
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
      data: list.map((c) => ({
        ...c,
        unreadCount: unreadMap.get(String(c._id)) || 0,
      })),
      hasMore: page * limit < total,
      stats: {
        total: await Complaint.countDocuments(),
        pending: pendingWeek,
        resolved: resolvedWeek,
      },
    });
  } catch (error) {
    console.error("Get Complaints Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch complaints." });
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
      { new: true, projection: { messages: 0 } },
    ).populate(POPULATE);

    if (!complaint) {
      return res.json({
        success: false,
        message: "Complaint not found or already resolved.",
      });
    }
    return res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    console.error("Resolve Complaint Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to resolve complaint." });
  }
};
exports.updateComplaintPriority = async (req, res) => {
  try {
    const { priority } = req.body;
    if (!["High", "Normal"].includes(priority)) {
      return res
        .status(400)
        .json({ success: false, message: "Priority must be High or Normal." });
    }

    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, status: "Pending" },
      { priority },
      { new: true, projection: { messages: 0 } },
    ).populate(POPULATE);

    if (!complaint) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Complaint not found or already resolved.",
        });
    }
    return res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    console.error("Update Priority Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update priority." });
  }
};
exports.getComplaintMessages = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await Complaint.findById(id)
      .select("status messages")
      .lean();
    if (!complaint) {
      return res.json({ success: false, message: "Complaint not found." });
    }

    await Complaint.updateOne(
      { _id: id },
      { $set: { "messages.$[m].readByRecipient": true } },
      {
        arrayFilters: [
          { "m.senderRole": { $ne: "Admin" }, "m.readByRecipient": false },
        ],
      },
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
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch messages." });
  }
};
exports.sendComplaintMessage = async (req, res) => {
  try {
    const text = (req.body?.text || "").trim();
    if (!text) {
      return res
        .status(400)
        .json({ success: false, message: "Message cannot be empty." });
    }
    if (text.length > 1000) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Message can be at most 1000 characters.",
        });
    }

    const updated = await Complaint.findOneAndUpdate(
      { _id: req.params.id, status: "Pending" },
      {
        $push: {
          messages: { senderId: req.user.id, senderRole: "Admin", text },
        },
      },
      { new: true, projection: { messages: { $slice: -1 } } },
    ).lean();

    if (!updated) {
      const exists = await Complaint.exists({ _id: req.params.id });
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists
          ? "This complaint is resolved, chat is read-only."
          : "Complaint not found.",
      });
    }

    return res.status(201).json({ success: true, data: updated.messages[0] });
  } catch (error) {
    console.error("Send Message Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send message." });
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 15, 50);
    console.log(userId, "id");
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
      const mine = (n.recipients || []).find(
        (r) => String(r.user) === String(userId),
      );
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
      { new: true, projection: { recipients: 1 } },
    );

    if (!notification) {
      return res.json({ success: false, message: "Notification not found." });
    }

    const mine = notification.recipients.find(
      (r) => String(r.user) === String(userId),
    );
    if (!mine?.deliveredAt) {
      await Notification.updateOne(
        { _id: id, "recipients.user": userId },
        { $set: { "recipients.$.deliveredAt": new Date() } },
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
      {
        status: "sent",
        recipients: { $elemMatch: { user: userId, readAt: null } },
      },
      { $set: { "recipients.$[r].readAt": new Date() } },
      { arrayFilters: [{ "r.user": userId, "r.readAt": null }] },
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
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch settings.",
        error: error.message,
      });
  }
};
exports.createSettings = async (req, res) => {
  try {
    const existing = await SystemSetting.findOne();
    if (existing) {
      return res
        .status(409)
        .json({
          success: false,
          message: "Settings already exist. Use update instead.",
        });
    }

    const { errors, data } = validateSettingsPayload(req.body, null, {
      partial: false,
    });
    if (errors.length) {
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }

    const settings = await SystemSetting.create(data);

    return res
      .status(201)
      .json({ success: true, message: "Settings created.", data: settings });
  } catch (error) {
    console.error("Create Settings Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to create settings.",
        error: error.message,
      });
  }
};
exports.updateSettings = async (req, res) => {
  try {
    const existing = await SystemSetting.findOne();
    if (!existing) {
      return res.json({
        success: false,
        message: "No settings found. Create them first.",
      });
    }

    const { errors, data } = validateSettingsPayload(req.body, existing, {
      partial: true,
    });
    if (errors.length) {
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }

    Object.assign(existing, data);
    await existing.save(); // runs the pre("validate") cross-field checks too

    return res
      .status(200)
      .json({ success: true, message: "Settings updated.", data: existing });
  } catch (error) {
    console.error("Update Settings Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to update settings.",
        error: error.message,
      });
  }
};
exports.deleteSettings = async (req, res) => {
  try {
    const deleted = await SystemSetting.findOneAndDelete();
    if (!deleted) {
      return res.json({ success: false, message: "No settings found." });
    }

    return res
      .status(200)
      .json({ success: true, message: "Settings deleted." });
  } catch (error) {
    console.error("Delete Settings Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete settings.",
        error: error.message,
      });
  }
};

exports.getAvailability = async (req, res) => {
  try {
    const { therapistId } = req.query;
    if (!mongoose.isValidObjectId(therapistId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid therapistId is required." });
    }

    const data = await TherapistAvailability.find({ therapistId })
      .sort({ type: -1, date: 1, createdAt: 1 })
      .lean();

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("Get Availability Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch availability.",
        error: error.message,
      });
  }
};
exports.createAvailability = async (req, res) => {
  try {
    const { therapistId } = req.body;
    if (!mongoose.isValidObjectId(therapistId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid therapistId is required." });
    }

    const therapist = await User.findOne({
      _id: therapistId,
      role: "Therapist",
    }).lean();
    if (!therapist) {
      return res
        .status(404)
        .json({ success: false, message: "Therapist not found." });
    }

    const { rule, error } = await buildRule(req.body, null);
    if (error) return res.status(400).json({ success: false, message: error });

    const clash = await findConflict(therapistId, rule);
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `This overlaps with an existing availability (${describe(clash)}).`,
      });
    }

    const created = await TherapistAvailability.create({
      therapistId,
      ...rule,
    });
    return res
      .status(201)
      .json({ success: true, message: "Availability added.", data: created });
  } catch (error) {
    console.error("Create Availability Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to add availability.",
        error: error.message,
      });
  }
};
exports.updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    const existing = await TherapistAvailability.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Availability not found." });
    }

    const { rule, error } = await buildRule(req.body, existing);
    if (error) return res.status(400).json({ success: false, message: error });

    const clash = await findConflict(existing.therapistId, rule, existing._id);
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `This overlaps with an existing availability (${describe(clash)}).`,
      });
    }

    // TODO (sessions step): if future sessions fall outside the new window, block or warn here.
    Object.assign(existing, rule);
    if (req.body.isActive !== undefined)
      existing.isActive = !!req.body.isActive;
    await existing.save();

    return res
      .status(200)
      .json({
        success: true,
        message: "Availability updated.",
        data: existing,
      });
  } catch (error) {
    console.error("Update Availability Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to update availability.",
        error: error.message,
      });
  }
};
exports.deleteAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    // TODO (sessions step): block if future sessions depend on this window.
    const deleted = await TherapistAvailability.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Availability not found." });
    }
    return res
      .status(200)
      .json({ success: true, message: "Availability deleted." });
  } catch (error) {
    console.error("Delete Availability Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete availability.",
        error: error.message,
      });
  }
};



exports.getBatchScheduleData = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!mongoose.isValidObjectId(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batchId.",
      });
    }

    const [batch, assignments] = await Promise.all([
      Batch.findById(batchId)
        .populate("therapistIds", "fullName email")
        .populate("childrenIds", "fullName")
        .lean(),

      BatchAssignment.find({ batchId })
        .populate("therapistId", "fullName email")
        .populate("childIds", "fullName")
        .lean(),
    ]);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    return res.json({
      success: true,
      data: {
        batch,
        assignments,
      },
    });
  } catch (error) {
    console.error("getBatchScheduleData:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load batch schedule data.",
    });
  }
};
exports.getBatchTherapistOptions = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId).lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);
    const { from, to } = planRange(batch, today);

    if (from > to) {
      return res.status(400).json({
        success: false,
        message: "This batch has already ended.",
      });
    }

    const [assignments, existing] = await Promise.all([
      TherapistAssignment.find({
        specialty: { $in: batch.speciality },
      })
        .populate("therapistId", "fullName email")
        .lean(),

      BatchAssignment.find({
        batchId: batch._id,
      }).lean(),
    ]);

    const therapistIds = [
      ...new Set(
        assignments
          .filter((a) => a.therapistId)
          .map((a) => String(a.therapistId._id)),
      ),
    ];

    const availability = therapistIds.length
      ? await TherapistAvailability.find({
          therapistId: { $in: therapistIds },
          isActive: true,
        }).lean()
      : [];

    const availabilityMap = new Set(
      availability
        .filter((r) =>
          r.type === "custom"
            ? r.date >= from && r.date <= to
            : (!r.effectiveTo || r.effectiveTo >= from) &&
              (!r.effectiveFrom || r.effectiveFrom <= to),
        )
        .map((r) => String(r.therapistId)),
    );

    const assignedMap = new Set(
      existing.map(
        (a) => `${String(a.therapistId)}|${a.speciality}`,
      ),
    );

    const data = batch.speciality.map((speciality) => {
      const map = new Map();

      for (const a of assignments) {
        if (!a.therapistId || a.specialty !== speciality) continue;

        const therapistId = String(a.therapistId._id);

        if (!map.has(therapistId)) {
          map.set(therapistId, {
            _id: a.therapistId._id,
            fullName: a.therapistId.fullName,
            email: a.therapistId.email,
            speciality,
            hasAvailability: availabilityMap.has(therapistId),
            alreadyAssigned: assignedMap.has(
              `${therapistId}|${speciality}`,
            ),
          });
        }
      }

      return {
        speciality,
        therapists: [...map.values()],
      };
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getBatchTherapistOptions:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch therapists.",
    });
  }
};
exports.getBatchSlotOptions = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId).lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const minutes = Number(req.body.sessionMinutes);

    if (!SESSION_TIMES.includes(minutes)) {
      return res.status(400).json({
        success: false,
        message: "Session time must be 45, 60, 90 or 120 minutes.",
      });
    }

    const team = Array.isArray(req.body.therapists)
      ? req.body.therapists
      : [];

    if (!team.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one therapist.",
      });
    }

    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);
    const { from, to } = planRange(batch, today);

    if (from > to) {
      return res.status(400).json({
        success: false,
        message: "This batch has already ended.",
      });
    }

    const ids = [
      ...new Set(team.map((t) => String(t.therapistId))),
    ];

    const [rules, existing] = await Promise.all([
      TherapistAvailability.find({
        therapistId: { $in: ids },
        isActive: true,
      }).lean(),

      BatchAssignment.find({
        batchId: batch._id,
        therapistId: { $in: ids },
      })
        .populate("therapistId", "fullName")
        .lean(),
    ]);

    const data = team.map((t) => {
      const therapistRules = rules.filter(
        (r) => String(r.therapistId) === String(t.therapistId),
      );

      return {
        therapistId: String(t.therapistId),
        speciality: t.speciality,
        days: weeklyOptions(
          therapistRules,
          from,
          to,
          minutes,
          st,
        ),
      };
    });

    // Existing batch sessions are returned as blocked slots.
    const blocked = {};

    WORKING_DAYS.forEach((day) => {
      blocked[day] = [];
    });

    for (const assignment of existing) {
      const therapistName =
        assignment.therapistId?.fullName || "Therapist";

      for (const session of assignment.sessions || []) {
        if (session.status === "cancelled") continue;
        if (session.date < today) continue;

        const day = weekdayOf(session.date);

        const exists = blocked[day].some(
          (x) =>
            x.therapistId === String(assignment.therapistId?._id) &&
            x.startTime === session.startTime &&
            x.endTime === session.endTime,
        );

        if (!exists) {
          blocked[day].push({
            therapistId: String(assignment.therapistId?._id),
            speciality: assignment.speciality,
            startTime: session.startTime,
            endTime: session.endTime,
            therapistName,
          });
        }
      }
    }

    return res.json({
      success: true,
      data,
      blocked,
    });
  } catch (error) {
    console.error("getBatchSlotOptions:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load available slots.",
    });
  }
};
exports.previewBatchSchedule = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId).lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const r = await analyzePlan(batch, req.body);

    if (r.error) {
      return res.status(400).json({
        success: false,
        message: r.error,
      });
    }

    const count = (list, plan) =>
      list.filter(
        (s) =>
          String(s.therapistId) === String(plan.therapistId) &&
          s.speciality === plan.speciality,
      ).length;

    const perTherapist = r.plans.map((plan) => ({
      therapistId: String(plan.therapistId),
      speciality: plan.speciality,
      name: r.names.get(String(plan.therapistId)) || "",
      sessions: count(r.toCreate, plan),
      conflicts: count(r.conflicts, plan),
      unavailable: count(r.unavailable, plan),
      existing: count(r.duplicates, plan),
    }));

    return res.json({
      success: true,
      data: {
        children: r.children.length,
        total: r.toCreate.length,
        perTherapist,
        conflicts: r.conflicts,
        unavailableCount: r.unavailable.length,
        existingCount: r.duplicates.length,
      },
    });
  } catch (error) {
    console.error("previewBatchSchedule:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check the schedule.",
    });
  }
};
exports.saveBatchSchedule = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId).lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const r = await analyzePlan(batch, req.body);

    if (r.error) {
      return res.status(400).json({
        success: false,
        message: r.error,
      });
    }

    if (r.conflicts.length && !req.body.skipConflicts) {
      return res.status(409).json({
        success: false,
        hasConflicts: true,
        message: "Some sessions conflict with existing bookings.",
        conflicts: r.conflicts,
      });
    }

    if (!r.toCreate.length) {
      return res.status(400).json({
        success: false,
        message:
          "No new sessions to create. Every date conflicts, is outside availability, or already exists.",
      });
    }

    let created = 0;

    for (const plan of r.plans) {
      const therapistId = String(plan.therapistId);

      const sessions = r.toCreate.filter(
        (s) =>
          s.therapistId === therapistId &&
          s.speciality === plan.speciality,
      );

      if (!sessions.length) continue;

      let assignment = await BatchAssignment.findOne({
        batchId: batch._id,
        therapistId,
        speciality: plan.speciality,
      });

      if (!assignment) {
        assignment = new BatchAssignment({
          batchId: batch._id,
          therapistId,
          speciality: plan.speciality,
          maxChildren: batch.maxChild,
          childIds: r.children,
          sessions: [],
        });
      }

      assignment.sessionMinutes = r.minutes;
      assignment.childIds = r.children;

      const newSessions = [];

      for (const s of sessions) {
        const session = assignment.sessions.create({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          status: "scheduled",
        });

        assignment.sessions.push(session);
        newSessions.push(session);
      }

      await assignment.save();

      // Create therapist-month Scheduling documents
      for (const session of newSessions) {
        const date = utcMidnight(session.date);

        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;

        let schedule = await Scheduling.findOne({
          therapistId,
          year,
          month,
        });

        if (!schedule) {
          schedule = new Scheduling({
            therapistId,
            year,
            month,
            appointments: [],
          });
        }

        const exists = schedule.appointments.some(
          (ap) =>
            ap.type === "batch" &&
            String(ap.batchSessionId) === String(session._id),
        );

        if (exists) continue;

        schedule.appointments.push({
          date,

          startTime: session.startTime,
          endTime: session.endTime,

          type: "batch",

          batchSessionId: session._id,
          batchId: batch._id,
          batchAssignmentId: assignment._id,

          sessionType: "regular",
          originalAppointmentId: null,

          children: r.children.map((childId) => ({
            childId,
            attendance_status: "Pending",
          })),
        });

        await schedule.save();
        created++;
      }
    }

    // Update batch therapist list
    await Batch.updateOne(
      { _id: batch._id },
      {
        $addToSet: {
          therapistIds: {
            $each: r.plans.map((p) => p.therapistId),
          },
        },
      },
    );

    return res.status(201).json({
      success: true,
      message: "Batch schedule created.",
      data: {
        created,
        children: r.children.length,
        skippedConflicts: r.conflicts.length,
        unavailable: r.unavailable.length,
        alreadyExisting: r.duplicates.length,
      },
    });
  } catch (error) {
    console.error("saveBatchSchedule:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save batch schedule.",
      error: error.message,
    });
  }
};
exports.getBatchEligibleChildren = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId)
      .select("childrenIds maxChild")
      .lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const currentIds = (batch.childrenIds || []).map(String);

    const search = String(req.query.search || "").trim();

    const filter = {
      role: "Child",
      _id: { $nin: currentIds },
    };

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const children = await User.find(
      filter,
      "fullName email",
    )
      .sort({ fullName: 1 })
      .lean();

    const remaining = Math.max(
      Number(batch.maxChild) - currentIds.length,
      0,
    );

    return res.json({
      success: true,
      data: {
        children,
        currentCount: currentIds.length,
        maxChild: batch.maxChild,
        remaining,
      },
    });
  } catch (error) {
    console.error("getBatchEligibleChildren:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load eligible children.",
    });
  }
};
exports.updateBatchChildren = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const normalizeIds = (value) => [
      ...new Set(
        (Array.isArray(value) ? value : [])
          .filter((id) => mongoose.isValidObjectId(id))
          .map(String),
      ),
    ];

    const remove = normalizeIds(req.body.removeChildIds);
    const add = normalizeIds(req.body.addChildIds);

    const current = new Set(
      (batch.childrenIds || []).map(String),
    );

    const actualRemove = remove.filter((id) => current.has(id));
    const actualAdd = add.filter((id) => !current.has(id));

    if (!actualRemove.length && !actualAdd.length) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update.",
      });
    }

    const newCount =
      current.size -
      actualRemove.length +
      actualAdd.length;

    if (newCount > batch.maxChild) {
      return res.status(400).json({
        success: false,
        message: `This batch can hold ${batch.maxChild} children.`,
      });
    }

    if (actualAdd.length) {
      const validCount = await User.countDocuments({
        _id: { $in: actualAdd },
        role: "Child",
      });

      if (validCount !== actualAdd.length) {
        return res.status(400).json({
          success: false,
          message: "Some children were not found.",
        });
      }
    }

    actualRemove.forEach((id) => current.delete(id));
    actualAdd.forEach((id) => current.add(id));

    const finalChildren = [...current];

    batch.childrenIds = finalChildren;
    await batch.save();

    const assignments = await BatchAssignment.find({
      batchId: batch._id,
    });

    if (!assignments.length) {
      return res.json({
        success: true,
        message: "Batch children updated.",
        data: {
          added: actualAdd.length,
          removed: actualRemove.length,
          skippedSessions: 0,
          skipped: [],
        },
      });
    }

    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);
    const batchEnd = dateKeyOf(batch.dateTo);

    if (actualRemove.length) {
      const schedules = await Scheduling.find({
        "appointments.batchId": batch._id,
      });

      for (const schedule of schedules) {
        let changed = false;

        for (const appointment of schedule.appointments) {
          if (
            appointment.type !== "batch" ||
            String(appointment.batchId) !== String(batch._id) ||
            dateKeyOf(appointment.date) < today
          ) {
            continue;
          }

          const before = appointment.children.length;

          appointment.children = appointment.children.filter(
            (child) =>
              !(
                actualRemove.includes(String(child.childId)) &&
                child.attendance_status === "Pending"
              ),
          );

          if (appointment.children.length !== before) {
            changed = true;
          }
        }

        if (changed) {
          await schedule.save();
        }
      }
    }

    const skipped = [];

    const childBusy = new Map(
      actualAdd.map((id) => [id, []]),
    );

    if (actualAdd.length) {
      const schedules = await Scheduling.find({
        "appointments.date": {
          $gte: utcMidnight(today),
          $lte: utcMidnight(batchEnd),
        },
        "appointments.children.childId": {
          $in: actualAdd,
        },
      }).lean();

      for (const schedule of schedules) {
        for (const appointment of schedule.appointments || []) {
          const date = dateKeyOf(appointment.date);

          if (date < today || date > batchEnd) continue;

          for (const child of appointment.children || []) {
            const childId = String(child.childId);

            if (!childBusy.has(childId)) continue;

            childBusy.get(childId).push({
              date,
              startTime: appointment.startTime,
              endTime: appointment.endTime,
            });
          }
        }
      }
    }

    for (const assignment of assignments) {
      assignment.childIds = finalChildren;
      await assignment.save();

      if (!actualAdd.length) continue;

      const upcomingSessions = (assignment.sessions || []).filter(
        (session) =>
          session.status === "scheduled" &&
          session.date >= today &&
          session.date <= batchEnd,
      );

      if (!upcomingSessions.length) continue;

      for (const childId of actualAdd) {
        const busy = childBusy.get(childId) || [];

        for (const session of upcomingSessions) {
          const hasConflict = busy.some(
            (b) =>
              b.date === session.date &&
              toMin(b.startTime) < toMin(session.endTime) &&
              toMin(session.startTime) < toMin(b.endTime),
          );

          if (hasConflict) {
            skipped.push({
              childId,
              date: session.date,
              startTime: session.startTime,
              endTime: session.endTime,
              reason: "Child already has another appointment.",
            });

            continue;
          }

          const sessionDate = utcMidnight(session.date);

          const year = sessionDate.getUTCFullYear();
          const month = sessionDate.getUTCMonth() + 1;

          const schedule = await Scheduling.findOne({
            therapistId: assignment.therapistId,
            year,
            month,
          });

          if (!schedule) continue;

          const appointment = schedule.appointments.find(
            (ap) =>
              ap.type === "batch" &&
              String(ap.batchId) === String(batch._id) &&
              String(ap.batchAssignmentId) === String(assignment._id) &&
              String(ap.batchSessionId) === String(session._id),
          );

          if (!appointment) continue;

          const alreadyAdded = appointment.children.some(
            (child) =>
              String(child.childId) === String(childId),
          );

          if (!alreadyAdded) {
            appointment.children.push({
              childId,
              attendance_status: "Pending",
            });

            await schedule.save();
          }
        }
      }
    }

    return res.json({
      success: true,
      message: "Batch children updated.",
      data: {
        added: actualAdd.length,
        removed: actualRemove.length,
        skippedSessions: skipped.length,
        skipped,
      },
    });
  } catch (error) {
    console.error("updateBatchChildren:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update batch children.",
    });
  }
};
exports.removeBatchAssignment = async (req, res) => {
  try {
    const { batchId, assignmentId } = req.params;

    if (
      !mongoose.isValidObjectId(batchId) ||
      !mongoose.isValidObjectId(assignmentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid batchId or assignmentId.",
      });
    }

    const assignment = await BatchAssignment.findOne({
      _id: assignmentId,
      batchId,
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Batch assignment not found.",
      });
    }

    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);

    // Remove future appointments belonging to this assignment.
    const schedules = await Scheduling.find({
      "appointments.batchAssignmentId": assignment._id,
    });

    let removedAppointments = 0;

    for (const schedule of schedules) {
      const before = schedule.appointments.length;

      schedule.appointments = schedule.appointments.filter(
        (appointment) =>
          !(
            String(appointment.batchAssignmentId) ===
              String(assignment._id) &&
            dateKeyOf(appointment.date) >= today
          ),
      );

      const removed =
        before - schedule.appointments.length;

      if (removed > 0) {
        removedAppointments += removed;
        await schedule.save();
      }
    }

    const therapistId = String(assignment.therapistId);

    // Delete assignment
    await BatchAssignment.deleteOne({
      _id: assignment._id,
    });

    // Check whether therapist still has another assignment
    // for this batch.
    const therapistStillAssigned =
      await BatchAssignment.exists({
        batchId,
        therapistId: assignment.therapistId,
      });

    if (!therapistStillAssigned) {
      await Batch.updateOne(
        { _id: batchId },
        {
          $pull: {
            therapistIds: assignment.therapistId,
          },
        },
      );
    }

    return res.json({
      success: true,
      message: "Batch assignment removed.",
      data: {
        assignmentId: String(assignment._id),
        therapistId,
        removedAppointments,
      },
    });
  } catch (error) {
    console.error("removeBatchAssignment:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove batch assignment.",
    });
  }
};
