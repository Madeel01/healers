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
const Package = require("../models/Package");
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
  typeof s === "string"
  && DATE_REGEX.test(s)
  && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

const weekdayOf = (s) => JS_DAY_TO_NAME[new Date(`${s}T00:00:00Z`).getUTCDay()];

const todayKey = (tz = "Asia/Karachi") => new Date().toLocaleDateString("en-CA", { timeZone: tz });

const describe = (r) =>
  r.type === "custom"
    ? `${r.date}, ${to12(r.startTime)}-${to12(r.endTime)}`
    : (r.slots || [])
      .map((s) => `${s.day} ${to12(s.startTime)}-${to12(s.endTime)}`)
      .join(", ");

const timesOverlap = (a, b) =>
  toMin(a.startTime) < toMin(b.endTime)
  && toMin(b.startTime) < toMin(a.endTime);

const rulesConflict = (a, b) => {
  if (a.type === "custom" && b.type === "custom") {
    return a.date === b.date && timesOverlap(a, b);
  }
  if (a.type === "custom" || b.type === "custom") {
    const c = a.type === "custom" ? a : b;
    const r = a.type === "custom" ? b : a;
    const day = weekdayOf(c.date);
    const inRange = (!r.effectiveFrom || c.date >= r.effectiveFrom)
      && (!r.effectiveTo || c.date <= r.effectiveTo);
    return (
      inRange
      && (r.slots || []).some((s) => s.day === day && timesOverlap(s, c))
    );
  }
  const rangesOverlap = (!a.effectiveTo || !b.effectiveFrom || a.effectiveTo >= b.effectiveFrom)
    && (!b.effectiveTo || !a.effectiveFrom || b.effectiveTo >= a.effectiveFrom);
  return (
    rangesOverlap
    && (a.slots || []).some((sa) => (b.slots || []).some((sb) => sa.day === sb.day && timesOverlap(sa, sb)))
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
      settings
      && (toMin(startTime) < toMin(settings.clinicStartTime)
        || toMin(endTime) > toMin(settings.clinicEndTime))
    ) {
      return `${prefix}Availability must be within clinic hours (${to12(settings.clinicStartTime)}-${
        to12(settings.clinicEndTime)
      }).`;
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
      if (seen.has(s.day)) {
        return { error: `${s.day} is added more than once.` };
      }
      seen.add(s.day);

      if (
        settings?.workingDays?.length
        && !settings.workingDays.includes(s.day)
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
    const effectiveTo = body.effectiveTo !== undefined ? body.effectiveTo : current?.effectiveTo;

    if (!isValidDate(effectiveFrom)) return { error: "Invalid start date." };
    if (effectiveTo && !isValidDate(effectiveTo)) {
      return { error: "Invalid end date." };
    }
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
  const startTime = body.startTime !== undefined ? body.startTime : current?.startTime;
  const endTime = body.endTime !== undefined ? body.endTime : current?.endTime;

  if (!isValidDate(date)) return { error: "A valid date is required." };
  if (date < today) return { error: "Date cannot be in the past." };
  if (
    settings?.workingDays?.length
    && !settings.workingDays.includes(weekdayOf(date))
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

  for (
    const field of [
      "clinicStartTime",
      "clinicEndTime",
      "breakStartTime",
      "breakEndTime",
    ]
  ) {
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
      !Array.isArray(body.workingDays)
      || body.workingDays.some((d) => !WORKING_DAYS.includes(d))
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
  if (body.email !== undefined) {
    out.email = String(body.email).trim().toLowerCase();
  }

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
      start
      && end
      && (settingsToMinutes(breakStart) < settingsToMinutes(start)
        || settingsToMinutes(breakEnd) > settingsToMinutes(end))
    ) {
      errors.push("Break time must fall within clinic working hours.");
    }
  }

  return { errors, data: out };
};
const pad = (n) => String(n).padStart(2, "0");

const formatDate = (date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${
    pad(
      date.getDate(),
    )
  }`;
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
    timeToMinutes(startA) < timeToMinutes(endB)
    && timeToMinutes(endA) > timeToMinutes(startB)
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
  (st.clinicStart == null || (a >= st.clinicStart && b <= st.clinicEnd))
  && !(st.breakStart != null && a < st.breakEnd && st.breakStart < b);

const availableOnDate = (rules, key, a, b) => {
  const day = weekdayOf(key);
  return rules.some((r) => {
    if (r.type === "custom") {
      return r.date === key && toMin(r.startTime) <= a && toMin(r.endTime) >= b;
    }
    if (
      (r.effectiveFrom && key < r.effectiveFrom)
      || (r.effectiveTo && key > r.effectiveTo)
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
      (r.effectiveTo && r.effectiveTo < from)
      || (r.effectiveFrom && r.effectiveFrom > to)
    ) {
      continue;
    }

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
  Object.values(out).forEach((l) => l.sort((x, y) => x.startTime.localeCompare(y.startTime)));
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
        !WORKING_DAYS.includes(s.day)
        || !TIME_REGEX.test(s.startTime || "")
        || !TIME_REGEX.test(s.endTime || "")
        || toMin(s.endTime) - toMin(s.startTime) !== minutes
      ) {
        return { error: "One of the selected slots is invalid." };
      }
    }
  }

  const therapistIds = [
    ...new Set(plans.map((p) => String(p.therapistId))),
  ];

  const eligible = await TherapistAssignment.find({
    therapistId: { $in: therapistIds },
    specialty: { $in: batch.speciality },
  }).lean();

  const notEligible = plans.find(
    (p) =>
      !eligible.some(
        (e) =>
          String(e.therapistId) === String(p.therapistId)
          && e.specialty === p.speciality,
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

  const [rules, users, schedules] = await Promise.all([
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

  const valid = [];
  const unavailable = [];

  for (const s of all) {
    const start = toMin(s.startTime);
    const end = toMin(s.endTime);

    const available = st.workingDays.includes(weekdayOf(s.date))
      && insideClinic(start, end, st)
      && availableOnDate(
        rulesBy.get(s.therapistId) || [],
        s.date,
        start,
        end,
      );

    (available ? valid : unavailable).push(s);
  }

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
          toMin(a.startTime) < toMin(b.endTime)
          && toMin(b.startTime) < toMin(a.endTime)
        ) {
          return {
            error: `${a.therapistName} (${to12(a.startTime)}) and ${b.therapistName} (${
              to12(b.startTime)
            }) overlap on ${a.date}. Pick different times.`,
          };
        }
      }
    }
  }

  const children = (batch.childrenIds || []).map(String);

  const busy = [];
  for (const sc of schedules) {
    for (const ap of sc.appointments || []) {
      busy.push({
        appointmentId: String(ap._id),
        therapistId: String(sc.therapistId?._id || sc.therapistId),
        therapistName: sc.therapistId?.fullName || "another therapist",

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
      });
    }
  }

  const conflicts = [];
  const duplicates = [];
  const toCreate = [];

  const range = (a, b) => `${to12(minutesToTime(a))}-${to12(minutesToTime(b))}`;

  for (const s of valid) {
    const a = toMin(s.startTime);
    const b = toMin(s.endTime);

    const hits = busy.filter(
      (x) =>
        x.date === s.date
        && x.a < b
        && a < x.b,
    );

    if (
      hits.some(
        (x) => x.batchId === String(batch._id) && x.therapistId === s.therapistId && x.a === a && x.b === b
      )
    ) {
      duplicates.push(s);
      continue;
    }


    const reasons = [];

    const therapistConflict = hits.find(
      (x) => x.therapistId === s.therapistId,
    );

    if (therapistConflict) {
      reasons.push(
        `${s.therapistName} already has a session at ${
          range(
            therapistConflict.a,
            therapistConflict.b,
          )
        }`,
      );
    }

    const childConflict = hits.find(
      (x) =>
        x.therapistId !== s.therapistId
        && x.children?.some((child) => children.includes(child.childId)),
    );

    if (childConflict) {
      const child = childConflict.children.find((child) => children.includes(child.childId));

      reasons.push(
        `${child?.childName || "A batch child"} already has a session with ${childConflict.therapistName} (${
          range(
            childConflict.a,
            childConflict.b,
          )
        })`,
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
const clockMinutes = (tz) => {
  const hhmm = new Date().toLocaleTimeString("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return toMin(hhmm);
};
const SLOT_STEP = 15; 
const INACTIVE_TYPES = ["cancel", "postponed"]; 
const loadBatchAppointments = (batchId, extraMatch = {}) => {
  const id = new mongoose.Types.ObjectId(String(batchId));
  return Scheduling.aggregate([
    { $match: { "appointments.batchId": id } },
    { $unwind: "$appointments" },
    { $match: { "appointments.batchId": id, ...extraMatch } },
    {
      $replaceRoot: {
        newRoot: { $mergeObjects: ["$appointments", { therapistId: "$therapistId" }] },
      },
    },
  ]);
};
const computeFreeSlots = async ({
  therapistId,
  childIds = [],
  date,
  minutes,
  minDate = null,
  maxDate = null,
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

  const children = childIds.map(String);

  const [rules, schedules] = await Promise.all([
    TherapistAvailability.find({ therapistId, isActive: true }).lean(),
    Scheduling.find({
      "appointments.date": utcMidnight(date),
      $or: [
        { therapistId },
        ...(children.length ? [{ "appointments.children.childId": { $in: children } }] : []),
      ],
    }).lean(),
  ]);

  const busy = [];
  for (const sc of schedules) {
    const mine = String(sc.therapistId) === String(therapistId);
    for (const ap of sc.appointments || []) {
      if (dateKeyOf(ap.date) !== date) continue;
      const hasChild = (ap.children || []).some((c) => children.includes(String(c.childId)));
      const inactive = INACTIVE_TYPES.includes(ap.sessionType);
      if (mine || (hasChild && !inactive)) {
        busy.push({ a: toMin(ap.startTime), b: toMin(ap.endTime) });
      }
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
      for (let a = toMin(w.startTime); a + minutes <= toMin(w.endTime); a += SLOT_STEP) {
        const b = a + minutes;
        if (seen.has(a)) continue;
        if (a <= nowMin) continue;
        if (!insideClinic(a, b, st)) continue;
        if (busy.some((x) => x.a < b && a < x.b)) continue;
        seen.add(a);
        slots.push({ startTime: minutesToTime(a), endTime: minutesToTime(b) });
      }
    }
  }

  slots.sort((x, y) => x.startTime.localeCompare(y.startTime));

  return {
    slots,
    reason: slots.length ? "" : "No free time on this date. Try another day.",
  };
};
const freeSlotsForDate = ({ batch, therapistId, date, minutes }) =>
  computeFreeSlots({
    therapistId,
    childIds: batch.childrenIds || [],
    date,
    minutes,
    minDate: dateKeyOf(batch.dateFrom),
    maxDate: dateKeyOf(batch.dateTo),
  });
const loadBatchAndAssignment = async (batchId, assignmentId) => {
  if (!mongoose.isValidObjectId(batchId) || !mongoose.isValidObjectId(assignmentId)) {
    return { status: 400, message: "Invalid batchId or assignmentId." };
  }
  const [batch, assignment] = await Promise.all([
    Batch.findById(batchId).lean(),
    BatchAssignment.findOne({ _id: assignmentId, batchId }).lean(),
  ]);
  if (!batch || !assignment) {
    return { status: 404, message: "Batch or assignment not found." };
  }
  return { batch, assignment };
};
 const addBatchAppointment = async ({
  therapistId,
  date,
  startTime,
  endTime,
  batchId,
  assignmentId,
  sessionType,
  originalAppointmentId = null,
  childIds,
}) => {
  const d = utcMidnight(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
 
  let schedule = await Scheduling.findOne({ therapistId, year, month });
  if (!schedule) {
    schedule = new Scheduling({ therapistId, year, month, appointments: [] });
  }
 
  schedule.appointments.push({
    date: d,
    startTime,
    endTime,
    type: "batch",
    batchId,
    batchAssignmentId: assignmentId,
    sessionType,
    originalAppointmentId,
    children: childIds.map((childId) => ({ childId, attendance_status: "Pending" })),
  });
 
  await schedule.save(); // runs the overlap validation hook
  return schedule.appointments[schedule.appointments.length - 1];
};
const createExtraSession = async ({
  batch,
  assignment,
  date,
  startTime,
  endTime,
  sessionType,
  originalAppointmentId = null,
  childIds,
}) => {
  const appointment = await addBatchAppointment({
    therapistId: assignment.therapistId,
    date,
    startTime,
    endTime,
    batchId: batch._id,
    assignmentId: assignment._id,
    sessionType,
    originalAppointmentId,
    childIds,
  });
  return { appointmentId: appointment._id };
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

exports.getTherapistsAssignUsers = async (req, res) => {
  try {
    const therapistId = req.user?._id || req.user?.id;

    if (!therapistId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(therapistId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid therapist ID",
      });
    }

    const assignments = await TherapistAssignment.find({
      therapistId,
    })
      .populate(
        "therapistId",
        "fullName name email profileImage role",
      )
      .populate(
        "childIds",
        "fullName name email phone profileImage fatherName parentName role",
      )
      .lean();

    const usersMap = new Map();

    assignments.forEach((assignment) => {
      const therapist = assignment.therapistId;

      const therapistName = therapist?.fullName
        || therapist?.name
        || "Therapist";

      (assignment.childIds || []).forEach((child) => {
        if (!child?._id) {
          return;
        }

        const childId = String(child._id);

        if (!usersMap.has(childId)) {
          usersMap.set(childId, {
            _id: child._id,
            id: childId,
            fullName: child.fullName
              || child.name
              || "Child",
            name: child.fullName
              || child.name
              || "Child",
            email: child.email || "",
            phone: child.phone || "",
            profileImage: child.profileImage || "",
            fatherName: child.fatherName
              || child.parentName
              || "",
            parentName: child.parentName || "",
            role: child.role || "Child",
            therapistId: therapist?._id || therapistId,
            therapistName,
            therapistProfileImage: therapist?.profileImage || "",
            specialty: assignment.specialty || "",
            displayName: `${
              child.fullName
              || child.name
              || "Child"
            } - ${therapistName}`,
          });
        }
      });
    });

    const data = Array.from(usersMap.values());

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error(
      "getTherapistsAssignUsers error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get assigned users",
      error: error.message,
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
          message: "Phone number must be in 03011234567 or +923011234567 format.",
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
      if (maxChildren !== undefined) {
        assignment.maxChildren = parseInt(maxChildren, 10);
      }
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
      !therapistId
      || (addChildIds.length === 0 && removeChildIds.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "therapistId and at least one of addChildIds/removeChildIds are required.",
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
          message: "Nothing to update — no existing assignment and no children to add.",
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
          message:
            `This therapist can have a maximum of ${maxChildren} children. You tried to assign ${uniqueAddIds.length}.`,
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
        message:
          `Only ${availableSlots} slot(s) available for this therapist after removals. You tried to add ${toAdd.length} new child(ren).`,
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
      (c) => !toRemove.includes(c.toString()),
    );
    assignment.childIds.push(...toAdd);

    await assignment.save();

    const messageParts = [];
    if (toAdd.length > 0) messageParts.push(`${toAdd.length} child(ren) added`);
    if (toRemove.length > 0) {
      messageParts.push(`${toRemove.length} child(ren) removed`);
    }
    if (alreadyAssignedIds.length > 0) {
      messageParts.push(`${alreadyAssignedIds.length} were already assigned`);
    }
    if (notAssignedForRemoval.length > 0) {
      messageParts.push(`${notAssignedForRemoval.length} were not assigned`);
    }

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
exports.getTherapistSchedule = async (req, res) => {
  try {
    const { therapistId } = req.params;
 
    if (!mongoose.isValidObjectId(therapistId)) {
      return res.status(400).json({ success: false, message: "Invalid therapistId." });
    }
 
    const therapist = await User.findOne(
      { _id: therapistId, role: "Therapist" },
      "fullName email phone",
    ).lean();
 
    if (!therapist) {
      return res.status(404).json({ success: false, message: "Therapist not found." });
    }
 
    const pastDays = Math.min(Math.max(parseInt(req.query.pastDays, 10) || 90, 1), 365);
 
    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);
    const nowMin = clockMinutes(st.tz);
    const cutoff = addDays(today, -pastDays);
 
    const [availability, assignments, schedules] = await Promise.all([
      TherapistAvailability.find({ therapistId, isActive: true })
        .sort({ type: -1, date: 1, createdAt: 1 })
        .lean(),
 
      TherapistAssignment.find({ therapistId }, "specialty").lean(),
 
      Scheduling.find({ therapistId })
        .populate("appointments.batchId", "batchName")
        .populate("appointments.batchAssignmentId", "speciality")
        .populate("appointments.children.childId", "fullName")
        .lean(),
    ]);
 
    const sessions = [];
 
    for (const sc of schedules) {
      for (const ap of sc.appointments || []) {
        const date = dateKeyOf(ap.date);
        if (date < cutoff) continue;
        const isCustom = ap.type === "custom";
        sessions.push({
          id: String(ap._id),
          date,
          startTime: ap.startTime,
          endTime: ap.endTime,
          type: ap.type, // "batch" or "custom"
          sessionType: ap.sessionType || "regular",
          batchId: ap.batchId?._id ? String(ap.batchId._id) : ap.batchId ? String(ap.batchId) : null,
          batchName: isCustom ? "Custom Appointment" : (ap.batchId?.batchName || "Batch Session"),
          speciality: ap.batchAssignmentId?.speciality || assignments[0]?.specialty || null,
          children: (ap.children || []).map((c) => ({
            childId: String(c.childId?._id || c.childId),
            fullName: c.childId?.fullName || "Child",
            attendance: c.attendance_status || "Pending",
          })),
          isPast: date < today || (date === today && toMin(ap.endTime) <= nowMin),
        });
      }
    }
 
    sessions.sort((a, b) =>
      a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
    );
 
    const upcoming = sessions.filter((s) => !s.isPast);
    const past = sessions.filter((s) => s.isPast).reverse();
 
    return res.json({
      success: true,
      data: {
        today,
        pastDays,
        therapist: {
          _id: therapist._id,
          fullName: therapist.fullName,
          email: therapist.email,
          phone: therapist.phone,
          specialties: [...new Set(assignments.map((a) => a.specialty).filter(Boolean))],
        },
        availability,
        upcoming,
        past,
      },
    });
  } catch (error) {
    console.error("getTherapistSchedule:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load therapist schedule.",
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

    if (
      !fullName
      || !email
      || !phone
      || !password
      || !fatherName
      || !fatherCnic
    ) {
      return res.json({
        success: false,
        message: "fullName, email, phone, parent name, parent CNIC and password are required.",
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
      existParent
      && normalizeName(existParent.fatherName) !== normalizeName(fatherName)
    ) {
      return res.status(409).json({
        success: false,
        message: "This parent CNIC already exists with a different parent name.",
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
        otherChildren.length > 0
        && fatherName !== undefined
        && otherChildren.some(
          (child) => normalizeName(child.fatherName) !== normalizeName(fatherName),
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

    const [pendingCount, pendingSinceYesterday, onLeaveDocs] = await Promise.all([
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

    // =========================================================
    // 1. STATS
    // =========================================================

    const startOfYesterday = new Date();
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);

    const [ratingResult, sinceYesterdayFeedback] =
      await Promise.all([
        Feedback.aggregate([
          {
            $group: {
              _id: null,
              averageRating: {
                $avg: "$rating",
              },
            },
          },
        ]),

        Feedback.countDocuments({
          createdAt: {
            $gte: startOfYesterday,
          },
          notes: {
            $nin: [null, ""],
          },
        }),
      ]);

    const averageSatisfaction = ratingResult.length
      ? Number(ratingResult[0].averageRating.toFixed(1))
      : 0;

    // =========================================================
    // 2. FETCH FEEDBACK ONCE
    // =========================================================
    //
    // We don't add any appointmentId index.
    // We simply load the fields we actually need.
    //
    // =========================================================

    const feedbacks = await Feedback.find(
      {
        notes: {
          $nin: [null, ""],
        },
      },
      {
        appointmentId: 1,
        therapistId: 1,
        rating: 1,
        notes: 1,
        replies: 1,
        createdAt: 1,
        updatedAt: 1,
      }
    )
      .populate("therapistId", "fullName email role")
      .lean()
      .sort({ createdAt: -1 });

    // =========================================================
    // 3. CREATE FEEDBACK MAP
    // =========================================================

    const feedbackMap = new Map();

    for (const feedback of feedbacks) {
      if (!feedback.appointmentId) continue;

      feedbackMap.set(
        feedback.appointmentId.toString(),
        feedback
      );
    }

    // =========================================================
    // 4. FETCH SCHEDULES
    // =========================================================
    //
    // We need schedules because appointment data is embedded
    // inside Scheduling.
    //
    // =========================================================

    const schedules = await Scheduling.find({})
      .populate("therapistId", "fullName email role")
      .populate("appointments.children.childId", "fullName")
      .lean();

    // =========================================================
    // 5. BUILD APPOINTMENT MAP ONCE
    // =========================================================

    const appointmentMap = new Map();

    for (const schedule of schedules) {
      for (const appointment of schedule.appointments || []) {
        appointmentMap.set(
          appointment._id.toString(),
          {
            appointment,
            therapistId: schedule.therapistId,
          }
        );
      }
    }

    // =========================================================
    // 6. FIND PENDING FEEDBACK
    // =========================================================

    const pendingFeedback = [];

    for (const schedule of schedules) {
      for (const appointment of schedule.appointments || []) {
        // Don't ask feedback for cancelled appointments
        if (appointment.sessionType === "cancel") {
          continue;
        }

        // -----------------------------------------------------
        // Calculate actual appointment END datetime
        // -----------------------------------------------------

        const appointmentEnd = new Date(appointment.date);

        const [hours, minutes] = appointment.endTime
          .split(":")
          .map(Number);

        appointmentEnd.setHours(hours, minutes, 0, 0);

        // Appointment hasn't finished yet
        if (appointmentEnd >= now) {
          continue;
        }

        // -----------------------------------------------------
        // Check feedback
        // -----------------------------------------------------

        const feedback = feedbackMap.get(
          appointment._id.toString()
        );

        // Feedback already exists
        if (feedback) {
          continue;
        }

        // -----------------------------------------------------
        // KEEP YOUR EXISTING FRONTEND STRUCTURE
        // -----------------------------------------------------

        pendingFeedback.push({
          appointmentId: appointment._id,

          therapistId: schedule.therapistId,

          childId:
            appointment.children?.length > 0
              ? appointment.children[0].childId
              : null,

          session: {
            date: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,

            attendanceStatus:
              appointment.children?.length > 0
                ? appointment.children[0].attendance_status
                : null,
          },
        });
      }
    }

    // =========================================================
    // 7. RESPONSE DATA
    // =========================================================

    let data = [];

    // =========================================================
    // ALL
    // =========================================================

    if (status === "all") {
      data = feedbacks.map((feedback) => {
        const appointmentData = feedback.appointmentId
          ? appointmentMap.get(
              feedback.appointmentId.toString()
            )
          : null;

        const { replies, ...feedbackData } = feedback;

        return {
          ...feedbackData,

          isRespond:
            Array.isArray(replies) &&
            replies.length > 0,

          appointment: appointmentData
            ? {
                startTime:
                  appointmentData.appointment.startTime,
              }
            : null,
        };
      });
    }

    // =========================================================
    // NEW
    // =========================================================

    if (status === "new") {
      const threeDaysAgo = new Date();

      threeDaysAgo.setDate(
        threeDaysAgo.getDate() - 3
      );

      data = feedbacks
        .filter(
          (feedback) =>
            feedback.createdAt >= threeDaysAgo
        )
        .map((feedback) => {
          const appointmentData =
            feedback.appointmentId
              ? appointmentMap.get(
                  feedback.appointmentId.toString()
                )
              : null;

          return {
            ...feedback,

            appointment: appointmentData
              ? {
                  startTime:
                    appointmentData.appointment
                      .startTime,
                }
              : null,
          };
        });
    }

    // =========================================================
    // PENDING
    // =========================================================

    if (status === "pending") {
      data = pendingFeedback;

      data.sort(
        (a, b) =>
          new Date(b.session.date) -
          new Date(a.session.date)
      );
    }

    // =========================================================
    // RESPONSE
    // =========================================================

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
    console.error(
      "Admin Feedback Management Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch feedback management data.",
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
      !batchName
      || !specialityList.length
      || !dateFrom
      || !dateTo
      || !maxChild
      || !fee
    ) {
      return res.status(400).json({
        success: false,
        message: "batchName, speciality (at least one), dateFrom, dateTo, Batch fee and Batch Size are required.",
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
      message: status === "draft"
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
      fs.unlink(oldPath, () => {});
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
        fs.unlink(oldPath, () => {});
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
    const { IsHide = false, userID = null } = req.body;

    const broadcast = await Notification.findById(broadcastId);

    if (!broadcast) {
      return res
        .status(404)
        .json({ success: false, message: "Broadcast not found." });
    }

    if (IsHide === true || IsHide === "true") {
      if (!userID) {
        return res.status(400).json({
          success: false,
          message: "userID is required when hiding a broadcast.",
        });
      }

      const recipient = broadcast.recipients.find(
        (item) => item.user?.toString() === userID.toString(),
      );

      if (!recipient) {
        return res.status(404).json({
          success: false,
          message: "User is not a recipient of this broadcast.",
        });
      }

      recipient.isDelete = true;

      await broadcast.save();

      return res.status(200).json({
        success: true,
        message: "Broadcast hidden for this user.",
      });
    }

    await Notification.findByIdAndDelete(broadcastId);

    if (broadcast.attachment?.url) {
      const filePath = path.join(
        __dirname,
        "..",
        broadcast.attachment.url.replace(/^\//, ""),
      );
      fs.unlink(filePath, () => {}); // best-effort cleanup, no need to block response on it
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
      { arrayFilters: [{ "m.senderRole": { $ne: "Admin" }, "m.readByRecipient": false }] },
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
      { $push: { messages: { senderId: req.user.id, senderRole: "Admin", text } } },
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
    const { typeFilter = "All" } = req.query;

    const filter = {
      status: "sent",
      recipients: {
        $elemMatch: {
          user: userId,
          $or: [
            { isDelete: false },
            { isDelete: { $exists: false } },
          ],
        },
      },
    };

    if (typeFilter && typeFilter !== "All") {
      filter.type = typeFilter;
    }

    const unreadFilter = {
      status: "sent",
      type: filter.type,
      recipients: {
        $elemMatch: {
          user: userId,
          readAt: null,
          $or: [
            { isDelete: false },
            { isDelete: { $exists: false } },
          ],
        },
      },
    };

    const [total, notifications, unreadCount] = await Promise.all([
      Notification.countDocuments(filter),

      Notification.find(filter)
        .populate("createdBy", "fullName role")
        .sort({ sentAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Notification.countDocuments(unreadFilter),
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
    if (req.body.isActive !== undefined) {
      existing.isActive = !!req.body.isActive;
    }
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
            : (!r.effectiveTo || r.effectiveTo >= from)
              && (!r.effectiveFrom || r.effectiveFrom <= to)
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

    const blocked = {};

    WORKING_DAYS.forEach((day) => {
      blocked[day] = [];
    });

    const nameById = new Map(
      existing.map((a) => [String(a.therapistId?._id), a.therapistId?.fullName || "Therapist"])
    );
    const specByAssignment = new Map(existing.map((a) => [String(a._id), a.speciality]));
    
    const batchAps = await loadBatchAppointments(batch._id);
    for (const ap of batchAps) {
      const tid = String(ap.therapistId);
      const date = dateKeyOf(ap.date);
      if (!ids.includes(tid) || INACTIVE_TYPES.includes(ap.sessionType) || date < today) continue;
    
      const day = weekdayOf(date);
      const exists = blocked[day].some(
        (x) => x.therapistId === tid && x.startTime === ap.startTime && x.endTime === ap.endTime
      );
      if (!exists) {
        blocked[day].push({
          therapistId: tid,
          speciality: specByAssignment.get(String(ap.batchAssignmentId)),
          startTime: ap.startTime,
          endTime: ap.endTime,
          therapistName: nameById.get(tid) || "Therapist",
        });
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
          String(s.therapistId) === String(plan.therapistId)
          && s.speciality === plan.speciality,
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
        message: "No new sessions to create. Every date conflicts, is outside availability, or already exists.",
      });
    }

    let created = 0;

    for (const plan of r.plans) {
      const therapistId = String(plan.therapistId);
      const sessions = r.toCreate.filter(
        (s) => s.therapistId === therapistId && s.speciality === plan.speciality
      );
      if (!sessions.length) continue;
    
      const key = { batchId: batch._id, therapistId, speciality: plan.speciality };
      await BatchAssignment.updateOne(
        key,
        {
          $set: { childIds: r.children, sessionMinutes: r.minutes },
          $setOnInsert: { maxChildren: batch.maxChild },
        },
        { upsert: true }
      );
      const assignment = await BatchAssignment.findOne(key).select("_id").lean();
    
      const byMonth = new Map();
      for (const s of sessions) {
        const k = s.date.slice(0, 7);
        if (!byMonth.has(k)) byMonth.set(k, []);
        byMonth.get(k).push(s);
      }
    
      for (const [k, list] of byMonth) {
        const [year, month] = k.split("-").map(Number);
        const schedule =
          (await Scheduling.findOne({ therapistId, year, month })) ||
          new Scheduling({ therapistId, year, month, appointments: [] });
    
        for (const s of list) {
          const exists = schedule.appointments.some(
            (ap) =>
              ap.type === "batch" &&
              String(ap.batchAssignmentId) === String(assignment._id) &&
              dateKeyOf(ap.date) === s.date &&
              ap.startTime === s.startTime
          );
          if (exists) continue;
    
          schedule.appointments.push({
            date: utcMidnight(s.date),
            startTime: s.startTime,
            endTime: s.endTime,
            type: "batch",
            batchId: batch._id,
            batchAssignmentId: assignment._id,
            sessionType: "regular",
            originalAppointmentId: null,
            children: r.children.map((childId) => ({ childId, attendance_status: "Pending" })),
          });
          created++;
        }
        await schedule.save();
      }
    }


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

    const batch = await Batch.findById(req.params.batchId)
      .select("childrenIds maxChild dateTo")
      .lean();

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
          .map(String)
      ),
    ];

    const remove = normalizeIds(req.body.removeChildIds);
    const add = normalizeIds(req.body.addChildIds);

    const current = new Set(
      (batch.childrenIds || []).map(String)
    );

    const actualRemove = remove.filter((id) =>
      current.has(id)
    );

    const actualAdd = add.filter((id) =>
      !current.has(id)
    );

    if (!actualRemove.length && !actualAdd.length) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update.",
      });
    }

    const newCount = current.size
      - actualRemove.length
      + actualAdd.length;

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

    await Batch.updateOne(
      { _id: batch._id },
      {
        $set: {
          childrenIds: finalChildren,
        },
      }
    );

    const assignments = await BatchAssignment.find({
      batchId: batch._id,
    })
      .select("_id therapistId sessions")
      .lean();

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

    await BatchAssignment.updateMany(
      { batchId: batch._id },
      {
        $set: {
          childIds: finalChildren,
        },
      }
    );

    const st = await loadScheduleSettings();

    const today = todayKey(st.tz);
    const batchEnd = dateKeyOf(batch.dateTo);


    if (actualRemove.length) {
      await Scheduling.updateMany(
        {
          appointments: {
            $elemMatch: {
              type: "batch",
              batchId: batch._id,
              date: {
                $gte: utcMidnight(today),
                $lte: utcMidnight(batchEnd),
              },
              children: {
                $elemMatch: {
                  childId: {
                    $in: actualRemove,
                  },
                  attendance_status: "Pending",
                },
              },
            },
          },
        },
        {
          $pull: {
            "appointments.$[appointment].children": {
              childId: {
                $in: actualRemove,
              },
              attendance_status: "Pending",
            },
          },
        },
        {
          arrayFilters: [
            {
              "appointment.type": "batch",
              "appointment.batchId": batch._id,
              "appointment.date": {
                $gte: utcMidnight(today),
                $lte: utcMidnight(batchEnd),
              },
            },
          ],
        }
      );
    }

    if (!actualAdd.length) {
      return res.json({
        success: true,
        message: "Batch children updated.",
        data: {
          added: 0,
          removed: actualRemove.length,
          skippedSessions: 0,
          skipped: [],
        },
      });
    }

    const addObjIds = actualAdd.map((id) => new mongoose.Types.ObjectId(id));
 
    const busyRows = await Scheduling.aggregate([
      { $match: { "appointments.children.childId": { $in: addObjIds } } },
      { $unwind: "$appointments" },
      {
        $match: {
          "appointments.children.childId": { $in: addObjIds },
          "appointments.date": { $gte: utcMidnight(today) },
          "appointments.sessionType": { $nin: INACTIVE_TYPES },
        },
      },
      { $replaceRoot: { newRoot: "$appointments" } },
    ]);
    
    const childBusy = new Map(actualAdd.map((id) => [id, []]));
    for (const ap of busyRows) {
      for (const c of ap.children || []) {
        const list = childBusy.get(String(c.childId));
        if (list) list.push({ date: dateKeyOf(ap.date), startTime: ap.startTime, endTime: ap.endTime });
      }
    }
    
    const upcomingAps = await loadBatchAppointments(batch._id, {
      "appointments.sessionType": { $nin: INACTIVE_TYPES },
      "appointments.date": { $gte: utcMidnight(today) },
    });
    
    const skipped = [];
    const ops = [];
    
    for (const ap of upcomingAps) {
      const date = dateKeyOf(ap.date);
      const already = new Set((ap.children || []).map((c) => String(c.childId)));
      const toAdd = [];
    
      for (const childId of actualAdd) {
        if (already.has(childId)) continue;
        const clash = (childBusy.get(childId) || []).some(
          (b) =>
            b.date === date &&
            toMin(b.startTime) < toMin(ap.endTime) &&
            toMin(ap.startTime) < toMin(b.endTime)
        );
        if (clash) {
          skipped.push({
            childId,
            date,
            startTime: ap.startTime,
            endTime: ap.endTime,
            reason: "Child already has another appointment.",
          });
        } else {
          toAdd.push({ childId, attendance_status: "Pending" });
        }
      }
    
      if (toAdd.length) {
        ops.push({
          updateOne: {
            filter: { "appointments._id": ap._id },
            update: { $push: { "appointments.$.children": { $each: toAdd } } },
          },
        });
      }
    }
    
    for (let i = 0; i < ops.length; i += 500) {
      await Scheduling.bulkWrite(ops.slice(i, i + 500), { ordered: false });
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
    console.error(
      "updateBatchChildren:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update batch children.",
    });
  }
};
exports.removeBatchAssignment = async (req, res) => {
  try {
    const { batchId, assignmentId } = req.params;

    if (
      !mongoose.isValidObjectId(batchId)
      || !mongoose.isValidObjectId(assignmentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid batchId or assignmentId.",
      });
    }

    const assignment = await BatchAssignment.findOne({
      _id: assignmentId,
      batchId,
    })
      .select("_id therapistId batchId")
      .lean();

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Batch assignment not found.",
      });
    }

    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);

    const schedules = await Scheduling.find({
      "appointments.batchAssignmentId": assignment._id,
    })
      .select("_id appointments._id appointments.date appointments.batchAssignmentId")
      .lean();

    const futureAppointmentIds = [];

    for (const schedule of schedules) {
      for (const appointment of schedule.appointments || []) {
        if (
          String(appointment.batchAssignmentId) !==
          String(assignment._id)
        ) {
          continue;
        }

        if (dateKeyOf(appointment.date) < today) {
          continue;
        }

        futureAppointmentIds.push(
          appointment._id
        );
      }
    }
    let removedAppointments = 0;

    if (futureAppointmentIds.length) {
      removedAppointments =
        futureAppointmentIds.length;

      await Scheduling.updateMany(
        {},
        {
          $pull: {
            appointments: {
              _id: {
                $in: futureAppointmentIds,
              },
            },
          },
        }
      );
      await Scheduling.deleteMany({
        appointments: { $size: 0 },
      });
    }

    const hasPast = await Scheduling.exists({ "appointments.batchAssignmentId": assignment._id });
    if (hasPast) {
      return res.json({
        success: true,
        message: "Upcoming sessions removed. Past sessions were kept for history.",
        data: { removedAppointments },
      });
    }
    await BatchAssignment.deleteOne({ _id: assignment._id });


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
            therapistIds:
              assignment.therapistId,
          },
        }
      );
    }

    return res.json({
      success: true,
      message: "Batch assignment removed.",
      data: {
        assignmentId: String(
          assignment._id
        ),
        therapistId: String(
          assignment.therapistId
        ),
        removedAppointments,
      },
    });
  } catch (error) {
    console.error(
      "removeBatchAssignment:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to remove batch assignment.",
    });
  }
};
exports.getBatchScheduleData = async (req, res) => {
  try {
    const { batchId } = req.params;
 
    if (!mongoose.isValidObjectId(batchId)) {
      return res.status(400).json({ success: false, message: "Invalid batchId." });
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
      return res.status(404).json({ success: false, message: "Batch not found." });
    }
 
    const aps = await loadBatchAppointments(batch._id);
    const byAssignment = new Map();
    for (const ap of aps) {
      const key = String(ap.batchAssignmentId);
      if (!byAssignment.has(key)) byAssignment.set(key, []);
      byAssignment.get(key).push({
        _id: ap._id,
        date: dateKeyOf(ap.date),
        startTime: ap.startTime,
        endTime: ap.endTime,
        sessionType: ap.sessionType || "regular",
        status: INACTIVE_TYPES.includes(ap.sessionType) ? "cancelled" : "scheduled",
      });
    }
    for (const a of assignments) {
      a.sessions = (byAssignment.get(String(a._id)) || []).sort((x, y) =>
        x.date === y.date ? x.startTime.localeCompare(y.startTime) : x.date.localeCompare(y.date)
      );
    }
    return res.json({ success: true, data: { batch, assignments } });

  } catch (error) {
    console.error("getBatchScheduleData:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load batch schedule data.",
    });
  }
};
exports.getSessionSlotOptions = async (req, res) => {
  try {
    const loaded = await loadBatchAndAssignment(req.params.batchId, req.params.assignmentId);
    if (loaded.status) {
      return res.status(loaded.status).json({ success: false, message: loaded.message });
    }
 
    const minutes = Number(req.body.sessionMinutes);
    if (!SESSION_TIMES.includes(minutes)) {
      return res.status(400).json({
        success: false,
        message: "Session time must be 45, 60, 90 or 120 minutes.",
      });
    }
 
    const r = await freeSlotsForDate({
      batch: loaded.batch,
      therapistId: loaded.assignment.therapistId,
      date: req.body.date,
      minutes,
    });
 
    if (r.error) return res.status(400).json({ success: false, message: r.error });
 
    return res.json({ success: true, data: { slots: r.slots, reason: r.reason } });
  } catch (error) {
    console.error("getSessionSlotOptions:", error);
    return res.status(500).json({ success: false, message: "Failed to load available times." });
  }
};
exports.createAdditionalSession = async (req, res) => {
  try {
    const loaded = await loadBatchAndAssignment(req.params.batchId, req.params.assignmentId);
    if (loaded.status) {
      return res.status(loaded.status).json({ success: false, message: loaded.message });
    }
    const { batch, assignment } = loaded;
    const { date, startTime, endTime } = req.body;
 
    if (!TIME_REGEX.test(startTime || "") || !TIME_REGEX.test(endTime || "")) {
      return res.status(400).json({ success: false, message: "Start and end time must be HH:mm." });
    }
    const minutes = toMin(endTime) - toMin(startTime);
    if (!SESSION_TIMES.includes(minutes)) {
      return res.status(400).json({
        success: false,
        message: "Session time must be 45, 60, 90 or 120 minutes.",
      });
    }
 
    const r = await freeSlotsForDate({
      batch,
      therapistId: assignment.therapistId,
      date,
      minutes,
    });
    if (r.error) return res.status(400).json({ success: false, message: r.error });
 
    if (!r.slots.some((s) => s.startTime === startTime && s.endTime === endTime)) {
      return res.status(409).json({
        success: false,
        message: "That time is no longer available. Pick another one.",
      });
    }
 
    await createExtraSession({
      batch,
      assignment,
      date,
      startTime,
      endTime,
      sessionType: "additional",
      childIds: batch.childrenIds || [],
    });
 
    return res.status(201).json({
      success: true,
      message: "Additional class created.",
      data: { date, startTime, endTime, children: (batch.childrenIds || []).length },
    });
  } catch (error) {
    console.error("createAdditionalSession:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create additional class.",
      error: error.message,
    });
  }
};
exports.postponeBatchSession = async (req, res) => {
  try {
    const { batchId, assignmentId, sessionId } = req.params;
    const loaded = await loadBatchAndAssignment(batchId, assignmentId);
    if (loaded.status) {
      return res.status(loaded.status).json({ success: false, message: loaded.message });
    }
    const { batch, assignment } = loaded;
 
    const { sessionId: appointmentId } = req.params;
 
    const originalDoc = await Scheduling.findOne(
      { appointments: { $elemMatch: { _id: appointmentId, batchAssignmentId: assignment._id } } },
      { therapistId: 1, "appointments.$": 1 }
    ).lean();
    const originalAp = originalDoc?.appointments?.[0];
    if (!originalAp) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }
    if (INACTIVE_TYPES.includes(originalAp.sessionType)) {
      return res.status(400).json({ success: false, message: "This session was already postponed or cancelled." });
    }
    
    const st = await loadScheduleSettings();
    const origDate = dateKeyOf(originalAp.date);
    if (origDate < todayKey(st.tz) || (origDate === todayKey(st.tz) && toMin(originalAp.endTime) <= clockMinutes(st.tz))) {
      return res.status(400).json({ success: false, message: "Past sessions can't be postponed." });
    }
    
    const createAlternate = req.body.createAlternate === true || req.body.createAlternate === "true";
    const minutes = toMin(originalAp.endTime) - toMin(originalAp.startTime);
    
    let alternate = null;
    if (createAlternate) {
      const { date, startTime, endTime } = req.body;
 
      if (!TIME_REGEX.test(startTime || "") || !TIME_REGEX.test(endTime || "")) {
        return res.status(400).json({ success: false, message: "Pick a date and time for the alternate session." });
      }
      if (toMin(endTime) - toMin(startTime) !== minutes) {
        return res.status(400).json({
          success: false,
          message: `The alternate session must be ${minutes} minutes long.`,
        });
      }
 
      const r = await freeSlotsForDate({
        batch,
        therapistId: assignment.therapistId,
        date,
        minutes,
      });
      if (r.error) return res.status(400).json({ success: false, message: r.error });
 
      if (!r.slots.some((s) => s.startTime === startTime && s.endTime === endTime)) {
        return res.status(409).json({
          success: false,
          message: "That time is no longer available. Pick another one.",
        });
      }
 
      const childIds = originalAp
        ? (originalAp.children || []).map((c) => c.childId)
        : batch.childrenIds || [];
 
      alternate = await createExtraSession({
        batch,
        assignment,
        date: req.body.date,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        sessionType: "alternate",
        originalAppointmentId: originalAp._id,
        childIds: (originalAp.children || []).map((c) => c.childId),
      });
    }

 
    await Scheduling.updateOne(
      { _id: originalDoc._id, "appointments._id": originalAp._id },
      { $set: { "appointments.$.sessionType": createAlternate ? "postponed" : "cancel" } }
    );
    
    return res.json({
      success: true,
      message: createAlternate ? "Session postponed and alternate session created." : "Session postponed.",
      data: { alternateSessionId: alternate ? String(alternate.appointmentId) : null },
    });
  } catch (error) {
    console.error("postponeBatchSession:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to postpone session.",
      error: error.message,
    });
  }
};
exports.deleteBatchSession = async (req, res) => {
  try {
    const { assignmentId, sessionId } = req.params;
    if (!mongoose.isValidObjectId(assignmentId) || !mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }
 
    const doc = await Scheduling.findOne(
      { appointments: { $elemMatch: { _id: sessionId, batchAssignmentId: assignmentId } } },
      { therapistId: 1, "appointments.$": 1 }
    ).lean();
    const ap = doc?.appointments?.[0];
    if (!ap) return res.status(404).json({ success: false, message: "Session not found." });
 
    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);
    const date = dateKeyOf(ap.date);
    if (date < today || (date === today && toMin(ap.endTime) <= clockMinutes(st.tz))) {
      return res.status(400).json({ success: false, message: "Past sessions can't be deleted." });
    }
 
    await Scheduling.updateOne({ _id: doc._id }, { $pull: { appointments: { _id: ap._id } } });
    return res.json({ success: true, message: "Session deleted." });
  } catch (error) {
    console.error("deleteBatchSession:", error);
    return res.status(500).json({ success: false, message: "Failed to delete session." });
  }
};



const loadChild = (childId) =>
  mongoose.isValidObjectId(childId)
    ? User.findOne({ _id: childId, role: "Child" }, "fullName email phone fatherName age").lean()
    : null;

exports.getChildSchedule = async (req, res) => {
  try {
    const { childId } = req.params;
    const child = await loadChild(childId);
    if (!child) {
      return res.status(404).json({ success: false, message: "Child not found." });
    }

    const pastDays = Math.min(Math.max(parseInt(req.query.pastDays, 10) || 90, 1), 365);

    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);
    const nowMin = clockMinutes(st.tz);
    const cutoff = addDays(today, -pastDays);

    const [schedules, batches] = await Promise.all([
      Scheduling.find({ "appointments.children.childId": childId })
        .populate("therapistId", "fullName")
        .populate("appointments.batchId", "batchName")
        .populate("appointments.batchAssignmentId", "speciality")
        .lean(),

      Batch.find({ childrenIds: childId })
        .select("batchName speciality dateFrom dateTo maxChild childrenIds")
        .sort({ dateFrom: -1 })
        .lean(),
    ]);

    const therapistIds = [
      ...new Set(schedules.map((s) => String(s.therapistId?._id || s.therapistId))),
    ];
    const therapistAssignments = therapistIds.length
      ? await TherapistAssignment.find({ therapistId: { $in: therapistIds } }, "therapistId specialty").lean()
      : [];
    const specByTherapist = new Map();
    for (const a of therapistAssignments) {
      if (a.specialty && !specByTherapist.has(String(a.therapistId))) {
        specByTherapist.set(String(a.therapistId), a.specialty);
      }
    }

    const sessions = [];

    for (const sc of schedules) {
      const therapistKey = String(sc.therapistId?._id || sc.therapistId);

      for (const ap of sc.appointments || []) {
        const mine = (ap.children || []).find((c) => String(c.childId) === String(childId));
        if (!mine) continue;

        const date = dateKeyOf(ap.date);
        if (date < cutoff) continue;

        const isCustom = ap.type === "custom";
        const sessionType = ap.sessionType || "regular";
        const isPast = date < today || (date === today && toMin(ap.endTime) <= nowMin);

        sessions.push({
          id: String(ap._id),
          date,
          startTime: ap.startTime,
          endTime: ap.endTime,
          type: ap.type,
          sessionType,
          batchId: ap.batchId?._id ? String(ap.batchId._id) : ap.batchId ? String(ap.batchId) : null,
          batchName: isCustom ? null : ap.batchId?.batchName || "Batch Session",
          speciality: ap.batchAssignmentId?.speciality || specByTherapist.get(therapistKey) || null,
          therapistId: therapistKey,
          therapistName: sc.therapistId?.fullName || "Therapist",
          attendance: mine.attendance_status || "Pending",
          isPast,
          canCancel: isCustom && !isPast && sessionType !== "cancel",
        });
      }
    }

    sessions.sort((a, b) =>
      a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
    );

    const upcoming = sessions.filter((s) => !s.isPast);
    const past = sessions.filter((s) => s.isPast).reverse();

    const counted = past.filter((s) => !INACTIVE_TYPES.includes(s.sessionType));
    const stats = {
      present: counted.filter((s) => s.attendance === "Complete").length,
      absent: counted.filter((s) => s.attendance === "Absent").length,
      notMarked: counted.filter((s) => s.attendance === "Pending").length,
      total: counted.length,
    };

    return res.json({
      success: true,
      data: {
        today,
        pastDays,
        child,
        stats,
        batches: batches.map((b) => ({
          _id: b._id,
          batchName: b.batchName,
          speciality: b.speciality,
          dateFrom: b.dateFrom,
          dateTo: b.dateTo,
          maxChild: b.maxChild,
          childCount: (b.childrenIds || []).length,
        })),
        upcoming,
        past,
      },
    });
  } catch (error) {
    console.error("getChildSchedule:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load child schedule.",
      error: error.message,
    });
  }
};
exports.getChildBatchOptions = async (req, res) => {
  try {
    const { childId } = req.params;
    const child = await loadChild(childId);
    if (!child) {
      return res.status(404).json({ success: false, message: "Child not found." });
    }

    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);

    const batches = await Batch.find({
      childrenIds: { $ne: childId },
      dateTo: { $gte: utcMidnight(today) },
      $expr: { $lt: [{ $size: { $ifNull: ["$childrenIds", []] } }, "$maxChild"] },
    })
      .select("batchName speciality dateFrom dateTo maxChild childrenIds")
      .sort({ dateFrom: 1 })
      .lean();

    return res.json({
      success: true,
      data: batches.map((b) => {
        const count = (b.childrenIds || []).length;
        return {
          _id: b._id,
          batchName: b.batchName,
          speciality: b.speciality,
          dateFrom: b.dateFrom,
          dateTo: b.dateTo,
          maxChild: b.maxChild,
          childCount: count,
          remaining: Math.max(b.maxChild - count, 0),
        };
      }),
    });
  } catch (error) {
    console.error("getChildBatchOptions:", error);
    return res.status(500).json({ success: false, message: "Failed to load batches." });
  }
};
exports.getChildCustomSlotOptions = async (req, res) => {
  try {
    const { childId } = req.params;
    const { therapistId, date } = req.body;
    const minutes = Number(req.body.sessionMinutes);

    if (!(await loadChild(childId))) {
      return res.status(404).json({ success: false, message: "Child not found." });
    }
    if (!mongoose.isValidObjectId(therapistId)) {
      return res.status(400).json({ success: false, message: "Select a therapist." });
    }
    if (!SESSION_TIMES.includes(minutes)) {
      return res.status(400).json({
        success: false,
        message: "Session time must be 45, 60, 90 or 120 minutes.",
      });
    }

    const r = await computeFreeSlots({ therapistId, childIds: [childId], date, minutes });
    if (r.error) return res.status(400).json({ success: false, message: r.error });

    return res.json({ success: true, data: { slots: r.slots, reason: r.reason } });
  } catch (error) {
    console.error("getChildCustomSlotOptions:", error);
    return res.status(500).json({ success: false, message: "Failed to load available times." });
  }
};
exports.createChildCustomAppointment = async (req, res) => {
  try {
    const { childId } = req.params;
    const { therapistId, date, startTime, endTime } = req.body;

    if (!(await loadChild(childId))) {
      return res.status(404).json({ success: false, message: "Child not found." });
    }
    if (!mongoose.isValidObjectId(therapistId)) {
      return res.status(400).json({ success: false, message: "Select a therapist." });
    }
    const therapist = await User.findOne({ _id: therapistId, role: "Therapist" }, "_id").lean();
    if (!therapist) {
      return res.status(404).json({ success: false, message: "Therapist not found." });
    }
    if (!TIME_REGEX.test(startTime || "") || !TIME_REGEX.test(endTime || "")) {
      return res.status(400).json({ success: false, message: "Start and end time must be HH:mm." });
    }
    const minutes = toMin(endTime) - toMin(startTime);
    if (!SESSION_TIMES.includes(minutes)) {
      return res.status(400).json({
        success: false,
        message: "Session time must be 45, 60, 90 or 120 minutes.",
      });
    }

    const r = await computeFreeSlots({ therapistId, childIds: [childId], date, minutes });
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    if (!r.slots.some((s) => s.startTime === startTime && s.endTime === endTime)) {
      return res.status(409).json({
        success: false,
        message: "That time is no longer available. Pick another one.",
      });
    }

    const d = utcMidnight(date);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;

    let schedule = await Scheduling.findOne({ therapistId, year, month });
    if (!schedule) {
      schedule = new Scheduling({ therapistId, year, month, appointments: [] });
    }

    schedule.appointments.push({
      date: d,
      startTime,
      endTime,
      type: "custom",
      sessionType: "regular",
      children: [{ childId, attendance_status: "Pending" }],
    });

    await schedule.save();

    return res.status(201).json({
      success: true,
      message: "Appointment created.",
      data: { date, startTime, endTime },
    });
  } catch (error) {
    console.error("createChildCustomAppointment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create appointment.",
      error: error.message,
    });
  }
};
exports.deleteChildCustomAppointment = async (req, res) => {
  try {
    const { childId, appointmentId } = req.params;

    if (!mongoose.isValidObjectId(childId) || !mongoose.isValidObjectId(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    const doc = await Scheduling.findOne({
      appointments: {
        $elemMatch: { _id: appointmentId, type: "custom", "children.childId": childId },
      },
    });
    const ap = doc?.appointments.id(appointmentId);

    if (!ap) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }

    const st = await loadScheduleSettings();
    const today = todayKey(st.tz);
    const date = dateKeyOf(ap.date);
    if (date < today || (date === today && toMin(ap.endTime) <= clockMinutes(st.tz))) {
      return res.status(400).json({
        success: false,
        message: "Past appointments can't be cancelled.",
      });
    }

    if ((ap.children || []).length > 1) {
      ap.children = ap.children.filter((c) => String(c.childId) !== String(childId));
    } else {
      doc.appointments.pull(ap._id);
    }

    await doc.save();

    return res.json({ success: true, message: "Appointment cancelled." });
  } catch (error) {
    console.error("deleteChildCustomAppointment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel appointment.",
      error: error.message,
    });
  }
};




exports.getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find()
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: packages,
    });
  } catch (error) {
    console.error("getAllPackages:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch packages.",
    });
  }
};
exports.getPackageById = async (req, res) => {
  try {
    const packageData = await Package.findById(req.params.packageId)
      .populate("createdBy", "fullName email")
      .lean();

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: "Package not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: packageData,
    });
  } catch (error) {
    console.error("getPackageById:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch package.",
    });
  }
};
exports.createPackage = async (req, res) => {
  try {
    const {
      name,
      type,
      specialities,
      price,
      sessionMinutes,
      sessions,
    } = req.body;

    if (!name || !type || !specialities || !price) {
      return res.status(400).json({
        success: false,
        message: "Name, type, speciality and price are required.",
      });
    }

    if (!Array.isArray(specialities) || specialities.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one speciality is required.",
      });
    }

    if (type === "per-session" && specialities.length !== 1) {
      return res.status(400).json({
        success: false,
        message: "Per-session package must have exactly one speciality.",
      });
    }

    const packageData = await Package.create({
      name: name.trim(),
      type,
      specialities,
      price: Number(price),
      sessionMinutes: Number(sessionMinutes) || 60,
      sessions: Number(sessions) || 1,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Package created successfully.",
      data: packageData,
    });
  } catch (error) {
    console.error("createPackage:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create package.",
    });
  }
};
exports.updatePackage = async (req, res) => {
  try {
    const {
      name,
      type,
      specialities,
      price,
      sessionMinutes,
      sessions,
    } = req.body;

    const packageData = await Package.findById(req.params.packageId);

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: "Package not found.",
      });
    }

    if (!name || !type || !specialities || !price) {
      return res.status(400).json({
        success: false,
        message: "Name, type, speciality and price are required.",
      });
    }

    if (!Array.isArray(specialities) || specialities.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one speciality is required.",
      });
    }

    if (type === "per-session" && specialities.length !== 1) {
      return res.status(400).json({
        success: false,
        message: "Per-session package must have exactly one speciality.",
      });
    }

    packageData.name = name.trim();
    packageData.type = type;
    packageData.specialities = specialities;
    packageData.price = Number(price);
    packageData.sessionMinutes = Number(sessionMinutes) || 60;
    packageData.sessions = Number(sessions) || 1;

    await packageData.save();

    return res.status(200).json({
      success: true,
      message: "Package updated successfully.",
      data: packageData,
    });
  } catch (error) {
    console.error("updatePackage:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update package.",
    });
  }
};
exports.deletePackage = async (req, res) => {
  try {
    const packageData = await Package.findById(req.params.packageId);

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: "Package not found.",
      });
    }

    await Package.findByIdAndDelete(req.params.packageId);

    return res.status(200).json({
      success: true,
      message: "Package deleted successfully.",
    });
  } catch (error) {
    console.error("deletePackage:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete package.",
    });
  }
};