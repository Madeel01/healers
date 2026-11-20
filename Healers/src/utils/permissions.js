export const SCREEN_PERMISSION = {
  Therapist: "therapists",
  TherapistAvailability: "therapists",
  TherapistSchedule: "therapists",

  Children: "children",
  ChildDetails: "children",
  ChildForm: "children",

  Schedule: "scheduling",
  ChildSchedule: "scheduling",
  ChildCustomAppointment: "scheduling",
  BatchSchedule: "scheduling",

  BatchManagment: "batches",
  BatchScheduleCreate: "batches",
  BatchSessionPostpone: "batches",
  BatchAdditionalClass: "batches",

  Feedback: "feedback",
  LeaveRequest: "leaverequest",
  StaffOnLeave: "leaverequest",
  BroadcastManagement: "broadcast",
  ComplainManagement: "complaints",

  FeeManagement: "fees",
  AddNewPackage: "fees",
  AllPackages: "fees",

  InvoiceManagement: "invoices",
  CreateNewInvoice: "invoices",
  InvoiceDetail: "invoices",
  FeeDetail: "invoices",
  InvoiceView: "invoices",

  ServiceManagement: "services",
  ProgramBuilder: "programbuilder",

  ChildMessages: "chat",
  ChatDetails: "chat",

  AdminQuarterlyReports: "reports",
  AdminAttendanceReport: "reports",
};

export const ADMIN_ONLY = [
  "AllUsers",
  "PermissionManagement",
  "SendPushNotification",
  "Settings",
];

export const canOpenScreen = (role, permissions, screenName) => {
  if (role === "Admin") return true;
  if (role !== "Manager") return false;
  if (ADMIN_ONLY.includes(screenName)) return false;

  const needed = SCREEN_PERMISSION[screenName];
  if (!needed) return true;                      
  return (permissions || []).includes(needed);
};