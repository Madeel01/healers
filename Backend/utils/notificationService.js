const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");

// Used as "createdBy" for automatic notifications (cron jobs, invoice jobs).
// Put any admin/system user's _id in your .env file.
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID;

const VALID_TYPES = [
  "System",
  "Appointment",
  "Therapy",
  "Message",
  "Reminder",
  "Alert",
  "General",
];

const TEMPLATE = {
  INVOICE_GENERATED: "invoice_generated",
  INVOICE_SENT: "invoice_sent",
  FEE_REMINDER: "fee_reminder",
  CLASS_REMINDER: "class_reminder",
  FEEDBACK_REMINDER: "feedback_reminder",
  LEAVE_REQUEST: "leave_request",
  LEAVE_REQUEST_REMINDER: "leave_request_reminder",
  LEAVE_APPROVED: "leave_approved",
  LEAVE_REJECTED: "leave_rejected",
  CUSTOM: "custom",
};


const money = (amount) => `PKR ${Number(amount || 0).toLocaleString()}`;

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const sentence = (...parts) => parts.filter(Boolean).join(" ");

const dateRange = (from, to) => {
  if (from && to) return `${formatDate(from)} to ${formatDate(to)}`;
  return formatDate(from || to);
};


const TEMPLATES = {
  // ---------- FEE ----------
  [TEMPLATE.INVOICE_GENERATED]: (d) => ({
    title: "New Invoice Generated",
    message: sentence(
      `Invoice ${d.invoiceNo} for ${d.childName} of ${money(d.amount)} has been generated.`,
      d.dueDate && `Due date: ${formatDate(d.dueDate)}.`,
    ),
    type: "Alert",
  }),

  [TEMPLATE.INVOICE_SENT]: (d) => ({
    title: "Invoice Sent",
    message: sentence(
      `Invoice ${d.invoiceNo} of ${money(d.amount)} for ${d.childName} has been sent to you.`,
      d.dueDate && `Please pay before ${formatDate(d.dueDate)}.`,
    ),
    type: "Alert",
  }),

  [TEMPLATE.FEE_REMINDER]: (d) => ({
    title: "Fee Payment Reminder",
    message: sentence(
      `A payment of ${money(d.amount)} for ${d.childName} is still pending.`,
      d.dueDate && `Due date: ${formatDate(d.dueDate)}.`,
    ),
    type: "Reminder",
  }),

  // ---------- CLASS ----------
  [TEMPLATE.CLASS_REMINDER]: (d) => ({
    title: "Upcoming Session Reminder",
    message: sentence(
      `${d.childName}'s ${d.serviceName || "session"} is coming up.`,
      d.therapistName && `Therapist: ${d.therapistName}.`,
      d.date && `Date: ${formatDate(d.date)}.`,
      d.time && `Time: ${d.time}.`,
    ),
    type: "Appointment",
  }),

  // ---------- FEEDBACK ----------
  [TEMPLATE.FEEDBACK_REMINDER]: (d) => ({
    title: "Session Feedback Pending",
    message: sentence(
      `Please submit your feedback for ${d.childName}'s session.`,
      d.date && `Session date: ${formatDate(d.date)}.`,
    ),
    type: "Reminder",
  }),

  // ---------- LEAVE ----------
  [TEMPLATE.LEAVE_REQUEST]: (d) => ({
    title: "New Leave Request",
    message: sentence(
      `${d.requesterName} has requested leave.`,
      dateRange(d.fromDate, d.toDate) && `Dates: ${dateRange(d.fromDate, d.toDate)}.`,
      d.reason && `Reason: ${d.reason}`,
    ),
    type: "Alert",
  }),

  [TEMPLATE.LEAVE_REQUEST_REMINDER]: (d) => ({
    title: "Leave Request Awaiting Action",
    message: sentence(
      `The leave request from ${d.requesterName} is still pending your review.`,
      dateRange(d.fromDate, d.toDate) && `Dates: ${dateRange(d.fromDate, d.toDate)}.`,
    ),
    type: "Reminder",
  }),

  [TEMPLATE.LEAVE_APPROVED]: (d) => ({
    title: "Leave Request Approved",
    message: sentence(
      "Your leave request has been approved.",
      dateRange(d.fromDate, d.toDate) && `Dates: ${dateRange(d.fromDate, d.toDate)}.`,
    ),
    type: "General",
  }),

  [TEMPLATE.LEAVE_REJECTED]: (d) => ({
    title: "Leave Request Rejected",
    message: sentence(
      "Your leave request was not approved.",
      d.reason && `Reason: ${d.reason}`,
    ),
    type: "General",
  }),

  // ---------- CUSTOM ----------
  // No built-in text. The caller passes title + message.
  [TEMPLATE.CUSTOM]: () => ({}),
};

const registerTemplate = (name, templateFn) => {
  TEMPLATES[name] = templateFn;
};



const buildContent = (options) => {
  const { template = TEMPLATE.CUSTOM, data = {}, title, message, type } = options;

  const templateFn = TEMPLATES[template];
  if (!templateFn) {
    throw new Error(`Unknown notification template: "${template}"`);
  }

  const fromTemplate = templateFn(data);

  const finalTitle = (title || fromTemplate.title || "").trim();
  const finalMessage = (message || fromTemplate.message || "").trim();

  if (!finalTitle || !finalMessage) {
    throw new Error("Title and message are required for a custom notification.");
  }

  const wantedType = type || fromTemplate.type;
  const finalType = VALID_TYPES.includes(wantedType) ? wantedType : "General";

  return { title: finalTitle, message: finalMessage, type: finalType };
};

const getRecipientIds = async ({ audience, roles, users }) => {
  if (audience === "users") {
    const uniqueIds = [...new Set(users.map(String))];
    return uniqueIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  }

  const roleList = audience === "role" ? roles : ["Therapist", "Child"];

  const found = await User.find({
    role: { $in: roleList },
    isActive: { $ne: false },
  })
    .select("_id")
    .lean();

  return found.map((user) => String(user._id));
};

const saveNotification = async ({ content, audience, roles, recipientIds, options }) => {
  const createdBy = options.createdBy || SYSTEM_USER_ID;
  if (!createdBy) {
    throw new Error("createdBy is missing. Pass it in options or set SYSTEM_USER_ID in .env");
  }

  const doc = {
    ...content,
    audience,
    roles: audience === "role" ? roles : [],
    users: audience === "users" ? recipientIds : [],
    recipients: recipientIds.map((id) => ({ user: id })),
    createdBy,
    attachment: options.attachment || { url: null, name: null, type: null },
    status: "sent",
    sentAt: new Date(),
    expiresAt: options.expiresAt || null,
  };

  const saveOptions = options.session ? { session: options.session } : undefined;
  const [notification] = await Notification.create([doc], saveOptions);
  return notification;
};

const send = async ({ audience, roles = [], users = [], options = {} }) => {
  try {
    const content = buildContent(options);
    const recipientIds = await getRecipientIds({ audience, roles, users });

    if (recipientIds.length === 0) {
      return { success: false, message: "No valid recipients found." };
    }

    const notification = await saveNotification({
      content,
      audience,
      roles,
      recipientIds,
      options,
    });

    return { success: true, data: notification };
  } catch (error) {
    console.error("Notification Service Error:", error.message);
    if (options.throwOnError) throw error;
    return { success: false, message: error.message };
  }
};


const sendToUser = (userId, options = {}) =>
  send({ audience: "users", users: [userId], options });

const sendToUsers = (userIds, options = {}) =>
  send({ audience: "users", users: userIds, options });


const sendToRole = (roles, options = {}) => {
  if (roles === "all") {
    return send({ audience: "all", options });
  }
  return send({ audience: "role", roles: [].concat(roles), options });
};

module.exports = {
  TEMPLATE,
  TEMPLATES,
  registerTemplate,
  sendToUser,
  sendToUsers,
  sendToRole,
};