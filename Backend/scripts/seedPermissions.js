
const mongoose = require("mongoose");

const Permission = require("../models/Permission");
const PermissionGroup = require("../models/PermissionGroup");

const initialPermissions = [
  {
    key: "dashboard",
    name: "Dashboard",
    module: "Dashboard",
    description: "Access dashboard",
  },
  {
    key: "users",
    name: "Users",
    module: "Users",
    description: "View and manage user records",
  },
  {
    key: "chat",
    name: "Chats",
    module: "Messages",
    description: "Access and manage messages",
  },
  {
    key: "invoices",
    name: "Invoices",
    module: "Invoices",
    description: "View and manage invoices",
  },
  {
    key: "programBuilder",
    name: "Program Builder",
    module: "Program Builder",
    description: "Manage therapy programs",
  },
  {
    key: "leaveRequest",
    name: "Leave Requests",
    module: "Leave Requests",
    description: "View, approve and reject leave requests",
  },
  {
    key: "feedback",
    name: "Feedback Management",
    module: "Feedback",
    description: "View and manage feedback",
  },
  {
    key: "broadcast",
    name: "Broadcast Management",
    module: "Broadcast",
    description: "View and manage broadcasts",
  },
  {
    key: "complaints",
    name: "Complaints",
    module: "Complaints",
    description: "View and manage complaints",
  },
  {
    key: "fees",
    name: "Fee Management",
    module: "Fees",
    description: "View and manage fee structures",
  },
  {
    key: "services",
    name: "Service Management",
    module: "Services",
    description: "View and manage services",
  },
  {
    key: "reports",
    name: "Reports",
    module: "Reports",
    description: "Access quarterly and attendance reports",
  },
  {
    key: "scheduling",
    name: "Scheduling",
    module: "Scheduling",
    description: "View and manage therapist and child schedules",
  },
  {
    key: "children",
    name: "Children",
    module: "Children",
    description: "View and manage child records",
  },
  {
    key: "therapists",
    name: "Therapists",
    module: "Therapists",
    description: "View and manage therapist records",
  },
  {
    key: "batches",
    name: "Batches",
    module: "Batches",
    description: "View and manage batches",
  },
];

// Basic permissions automatically assigned to every Manager.
const managerDefaultKeys = [
  "dashboard",
  "users",
  "children",
  "therapists",
  "batches",
  "scheduling",
  "reports",
];

const seedPermissions = async () => {
  try {
    await mongoose.connect("mongodb://thehealerskpk_db_user:LtNEh6OflcIdLthE@ac-9jthydw-shard-00-00.h6wruvp.mongodb.net:27017,ac-9jthydw-shard-00-01.h6wruvp.mongodb.net:27017,ac-9jthydw-shard-00-02.h6wruvp.mongodb.net:27017/HEALERS?ssl=true&replicaSet=atlas-qvc2hf-shard-0&authSource=admin&appName=Healers");

    console.log("Database connected.");

    // 1. Create permissions if they don't already exist.
    for (const permission of initialPermissions) {
      await Permission.updateOne(
        { key: permission.key },
        {
          $setOnInsert: permission,
        },
        { upsert: true }
      );
    }

    console.log("Permissions seeded successfully.");

    // 2. Find Manager default permissions.
    const managerPermissions = await Permission.find({
      key: { $in: managerDefaultKeys },
      isActive: true,
    }).select("_id key");

    if (managerPermissions.length !== managerDefaultKeys.length) {
      throw new Error(
        "Some Manager default permissions were not found. Check permission keys."
      );
    }

    // 3. Create default Manager group only if it doesn't exist.
    let managerDefaultGroup = await PermissionGroup.findOne({
      type: "default",
      appliesToRole: "Manager",
    });

    if (!managerDefaultGroup) {
      managerDefaultGroup = await PermissionGroup.create({
        name: "Default Manager Permissions",
        description: "Basic permissions automatically assigned to Managers.",
        permissions: managerPermissions.map((permission) => permission._id),
        type: "default",
        appliesToRole: "Manager",
        isActive: true,
      });

      console.log("Default Manager permission group created.");
    } else {
      console.log(
        "Default Manager group already exists. Existing permissions preserved."
      );
    }

    console.log("Permission seeding completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Permission seeding failed:", error);
    process.exit(1);
  }
};

seedPermissions();
