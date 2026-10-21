import SystemSetting from "../models/SystemSetting";
const WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

// Helper 1: Get current date and time in saved timezone
export async function getSystemLocalDateTime() {
  const settings = await loadScheduleSettings();
  const timezone = settings.tz || "Asia/Karachi";

  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return {
    timezone,
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    dateTime: `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`,
  };
}


// Helper 2: Convert a Date/instant to saved timezone date and time
export async function toSystemLocalDateTime(date = new Date()) {
  const settings = await loadScheduleSettings();
  const timezone = settings.tz || "Asia/Karachi";

  const value = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(value.getTime())) {
    throw new Error("Invalid date/time provided.");
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return {
    timezone,
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    dateTime: `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`,
  };
}