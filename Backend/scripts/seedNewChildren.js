require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Package = require("../models/Package");

const EMAIL_DOMAIN = "gmail.com";
const DEFAULT_PASSWORD = "test@123";
const fs = require("fs");
const path = require("path");
// CNICs continue from 3500000000016.
// Hamdan and Azan share the same father CNIC.

const children = [
  {
    fullName: "Muhammad Hisham",
    fatherName: "Attullah",
    fatherCnic: "3500000000017",
    address: "",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: null,
    phone: "03009086407",
    age: 0,
    monthlyAmount: 7500,
  },
  {
    fullName: "Marukh",
    fatherName: "Nadeem",
    fatherCnic: "3500000000018",
    address: "",
    gender: "Female",
    diagnosis: "CP",
    dateOfBirth: null,
    phone: "03219301814",
    age: 0,
    monthlyAmount: 25000,
  },
  {
    fullName: "Abdullah",
    fatherName: "Zubair",
    fatherCnic: "3500000000019",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03229950208",
    age: 0,
    monthlyAmount: 32500,
  },
  {
    fullName: "Anaya Asad",
    fatherName: "Asad",
    fatherCnic: "3500000000020",
    address: "",
    gender: "Female",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03139333813",
    age: 0,
    monthlyAmount: 20000,
  },
  {
    fullName: "Khuram",
    fatherName: "Muhammad Ali",
    fatherCnic: "3500000000021",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03139888932",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Arman Khan",
    fatherName: "Neelofar",
    fatherCnic: "3500000000022",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03201972939",
    age: 0,
    monthlyAmount: 30000,
  },
  {
    fullName: "Zaryab",
    fatherName: "Hammad Ali",
    fatherCnic: "3500000000023",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03014600401",
    age: 0,
    monthlyAmount: 12000,
  },
  {
    fullName: "Arham Coclair",
    fatherName: "Fazal Zahid",
    fatherCnic: "3500000000024",
    address: "",
    gender: "Male",
    diagnosis: "Deaf",
    dateOfBirth: null,
    phone: "03119248739",
    age: 0,
    monthlyAmount: 10000,
  },
  {
    fullName: "Abdullah Maneri",
    fatherName: "Muhammad Asim",
    fatherCnic: "3500000000025",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03002260606",
    age: 0,
    monthlyAmount: 20000,
  },
  {
    fullName: "Afiya",
    fatherName: "Ahmad",
    fatherCnic: "3500000000026",
    address: "",
    gender: "Female",
    diagnosis: "CP",
    dateOfBirth: null,
    phone: "03459499429",
    age: 0,
    monthlyAmount: 12000,
  },
  {
    fullName: "Muhammad Hamza",
    fatherName: "Asim Khan",
    fatherCnic: "3500000000027",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03439588829",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Sherjeel",
    fatherName: "Hamid Ali",
    fatherCnic: "3500000000028",
    address: "",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: null,
    phone: "03196141988",
    age: 0,
    monthlyAmount: 31000,
  },
  {
    fullName: "Usman Ayaz",
    fatherName: "Shoukat Ayaz",
    fatherCnic: "3500000000029",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03339426146",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Hamdan",
    fatherName: "Qasim",
    fatherCnic: "3500000000030",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "009966508415486",
    age: 0,
    monthlyAmount: 25000,
  },
  {
    fullName: "Azan",
    fatherName: "Qasim",
    fatherCnic: "3500000000030",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "009966508415486",
    age: 0,
    monthlyAmount: 25000,
  },
  {
    fullName: "Danyal",
    fatherName: "Irum",
    fatherCnic: "3500000000031",
    address: "",
    gender: "Male",
    diagnosis: "Blind",
    dateOfBirth: null,
    phone: "03177637519",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Hiban",
    fatherName: "Imran",
    fatherCnic: "3500000000032",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03335599645",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Sajdan",
    fatherName: "Fawad",
    fatherCnic: "3500000000033",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03108686997",
    age: 0,
    monthlyAmount: 25000,
  },
  {
    fullName: "Rehma",
    fatherName: "Amir",
    fatherCnic: "3500000000034",
    address: "",
    gender: "Female",
    diagnosis: "ADHD",
    dateOfBirth: null,
    phone: "033325428893",
    age: 0,
    monthlyAmount: 31000,
  },
  {
    fullName: "Azhan",
    fatherName: "Naveed",
    fatherCnic: "3500000000035",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03015453434",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Azlan Ahmad",
    fatherName: "Azharullah",
    fatherCnic: "3500000000036",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03469810360",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Shah Saud",
    fatherName: "Amir Zaib",
    fatherCnic: "3500000000037",
    address: "",
    gender: "Male",
    diagnosis: "CP",
    dateOfBirth: null,
    phone: "03159242041",
    age: 0,
    monthlyAmount: 20000,
  },
  {
    fullName: "Horiya",
    fatherName: "Imad Bacha",
    fatherCnic: "3500000000038",
    address: "",
    gender: "Female",
    diagnosis: "ADHD",
    dateOfBirth: null,
    phone: "03116516264",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Reyan",
    fatherName: "Sajad Ahmad",
    fatherCnic: "3500000000039",
    address: "",
    gender: "Male",
    diagnosis: "Down Syndrome",
    dateOfBirth: null,
    phone: "03139413889",
    age: 0,
    monthlyAmount: 20000,
  },
  {
    fullName: "Mahnoor Khan",
    fatherName: "Azeem Bacha",
    fatherCnic: "3500000000040",
    address: "",
    gender: "Female",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03144922777",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Horiya Khan",
    fatherName: "Hamza Murad",
    fatherCnic: "3500000000041",
    address: "",
    gender: "Female",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03009598639",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Arqam",
    fatherName: "Amir Ali",
    fatherCnic: "3500000000042",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03468777380",
    age: 0,
    monthlyAmount: 20000,
  },
  {
    fullName: "Maryum Akhtar",
    fatherName: "Akhter Iqbal",
    fatherCnic: "3500000000043",
    address: "",
    gender: "Female",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03485479135",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Urhan",
    fatherName: "Adnan",
    fatherCnic: "3500000000044",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03341382173",
    age: 0,
    monthlyAmount: 25000,
  },
  {
    fullName: "Hanzla Malik",
    fatherName: "Musin Malik",
    fatherCnic: "3500000000045",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03159302240",
    age: 0,
    monthlyAmount: 25000,
  },
  {
    fullName: "Muhammad Saad",
    fatherName: "Mirza Muhammad",
    fatherCnic: "3500000000046",
    address: "",
    gender: "Male",
    diagnosis: "Stammering",
    dateOfBirth: null,
    phone: "03238839121",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Ahad Ullah",
    fatherName: "Imadullah",
    fatherCnic: "3500000000047",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03139213014",
    age: 0,
    monthlyAmount: 20000,
  },
  {
    fullName: "Yazdan",
    fatherName: "Ahlaq Ahmad",
    fatherCnic: "3500000000048",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03111997266",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "M Yousaf",
    fatherName: "Hamais Khan",
    fatherCnic: "3500000000049",
    address: "",
    gender: "Male",
    diagnosis: "Stammering",
    dateOfBirth: null,
    phone: "03149763829",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Meerab Fatima",
    fatherName: "Iqra Rehman",
    fatherCnic: "3500000000050",
    address: "",
    gender: "Female",
    diagnosis: "Cochlear",
    dateOfBirth: null,
    phone: "03164575605",
    age: 0,
    monthlyAmount: null,
  },
  {
    fullName: "Syeda Shafaq",
    fatherName: "Tufail",
    fatherCnic: "3500000000051",
    address: "",
    gender: "Female",
    diagnosis: "Blind",
    dateOfBirth: null,
    phone: "03129428196",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Ayesha Sadeeqa",
    fatherName: "Taqweemul Haq",
    fatherCnic: "3500000000052",
    address: "",
    gender: "Female",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "031795499085",
    age: 0,
    monthlyAmount: 12000,
  },
  {
    fullName: "Huzaima",
    fatherName: "Alamgir",
    fatherCnic: "3500000000053",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03018345730",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Abu Bakar",
    fatherName: "Zuhaid",
    fatherCnic: "3500000000054",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03249380388",
    age: 0,
    monthlyAmount: 10000,
  },
  {
    fullName: "Abdur Rehman",
    fatherName: "Saaz Wali Khan",
    fatherCnic: "3500000000055",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03109963449",
    age: 0,
    monthlyAmount: 7500,
  },
  {
    fullName: "Adeel",
    fatherName: "Ghani",
    fatherCnic: "3500000000056",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03362733666",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Noman Shakir",
    fatherName: "Shakir",
    fatherCnic: "3500000000057",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03288000937",
    age: 0,
    monthlyAmount: 0,
  },
  {
    fullName: "Muhammad Zeshan",
    fatherName: "",
    fatherCnic: "3500000000058",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03109529794",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Muhammad Mahad",
    fatherName: "Abdullah",
    fatherCnic: "3500000000059",
    address: "",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: null,
    phone: "03106767907",
    age: 0,
    monthlyAmount: 12000,
  },
  {
    fullName: "Huzaifa Bilal",
    fatherName: "Hazrat Bilal",
    fatherCnic: "3500000000060",
    address: "",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: null,
    phone: "03139702085",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Essa",
    fatherName: "Mujtaba Hursheed",
    fatherCnic: "3500000000061",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03219118939",
    age: 0,
    monthlyAmount: 25000,
  },
  {
    fullName: "Mashal Khan",
    fatherName: "Tyba Naz",
    fatherCnic: "3500000000062",
    address: "",
    gender: "Female",
    diagnosis: "ADHD",
    dateOfBirth: null,
    phone: "0046704010174",
    age: 0,
    monthlyAmount: 47600,
  },
  {
    fullName: "Mustafa Maneri",
    fatherName: "Hairaz Khan",
    fatherCnic: "3500000000063",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03339422662",
    age: 0,
    monthlyAmount: 32500,
  },
  {
    fullName: "Abu Bakar Sadeeq",
    fatherName: "Sher Afsar Khan",
    fatherCnic: "3500000000064",
    address: "",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: null,
    phone: "03333367760",
    age: 0,
    monthlyAmount: 15000,
  },
  {
    fullName: "Sakeena",
    fatherName: "Hiader Zaman",
    fatherCnic: "3500000000065",
    address: "",
    gender: "Female",
    diagnosis: "CP",
    dateOfBirth: null,
    phone: "03192166649",
    age: 0,
    monthlyAmount: 22500,
  },
  {
    fullName: "Abiha Fatima",
    fatherName: "Saeed",
    fatherCnic: "3500000000066",
    address: "",
    gender: "Female",
    diagnosis: "CP",
    dateOfBirth: null,
    phone: "03113334420",
    age: 0,
    monthlyAmount: 30000,
  },
];

function createEmail(fullName, fatherName) {
  const childFirstName = fullName.trim().split(/\s+/)[0];

  const fatherFirstName = fatherName?.trim()
    ? fatherName.trim().split(/\s+/)[0]
    : "Parent";

  return `${childFirstName}.${fatherFirstName}@${EMAIL_DOMAIN}`
    .toLowerCase()
    .replace(/[^a-z0-9.@]/g, "");
}

// Create or reuse monthly packages
async function createPackages() {
  const createdBy = "6af324ed1a7ac719cd817fe4";

  if (!mongoose.Types.ObjectId.isValid(createdBy)) {
    throw new Error("Valid PACKAGE_CREATED_BY is required in .env");
  }

  const amounts = [
    ...new Set(
      children
        .map((child) => Number(child.monthlyAmount))
        .filter((amount) => Number.isFinite(amount) && amount > 0)
    ),
  ].sort((a, b) => a - b);

  const packageMap = {};

  for (const amount of amounts) {
    const packageName = `Monthly Package - Rs. ${amount}`;

    const pkg = await Package.findOneAndUpdate(
      {
        name: packageName,
        type: "per-month",
      },
      {
        $set: {
          price: amount,
          createdBy,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    packageMap[amount] = pkg._id;

    console.log(
      `PACKAGE READY: ${packageName} | ${pkg._id}`
    );
  }

  return packageMap;
}
function saveStudentsToJson(records) {
  const exportDir = path.join(__dirname, "../exports");

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filePath = path.join(exportDir, "new-children.json");

  fs.writeFileSync(
    filePath,
    JSON.stringify(records, null, 2),
    "utf8"
  );

  console.log(`\nJSON exported successfully: ${filePath}`);
}
async function createChildUsers() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    if (!DEFAULT_PASSWORD || DEFAULT_PASSWORD.length < 8) {
      throw new Error("Default password must be at least 8 characters.");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    // Create packages first
    const packageMap = await createPackages();

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const exportedRecords = [];
    for (const child of children) {
      try {
        if (
          !child.fatherCnic ||
          !/^\d{13}$/.test(child.fatherCnic)
        ) {
          throw new Error("Valid 13-digit father CNIC is required.");
        }

        const email = createEmail(
          child.fullName,
          child.fatherName
        );

        const existing = await User.findOne({ email });

        if (existing) {
          console.log(`SKIPPED: ${email} already exists`);
          skipped++;
          continue;
        }

        const amount = Number(child.monthlyAmount);

        const packageId =
          Number.isFinite(amount) && amount > 0
            ? packageMap[amount] || null
            : null;

        const user = await User.create({
          fullName: child.fullName,
          email,
          fatherCnic: child.fatherCnic,
          password: hashedPassword,
          phone: child.phone,
          role: "Child",
          permissions: [],

          biometricKey:
            "bio-" +
            Date.now() +
            "-" +
            Math.random().toString(36).substring(2, 10),

          agreeTerms: true,
          isLogin: false,

          fatherName: child.fatherName,
          address: child.address,
          age: child.age,

          dateOfBirth: child.dateOfBirth
            ? new Date(`${child.dateOfBirth}T00:00:00.000Z`)
            : null,

          gender: child.gender,
          diagnosis: child.diagnosis,

          packageId,
          discountedPrice: null,

          isOnline: false,
          lastActive: null,
          profileImage: "",
          isActive: true,
          pushTokens: [],
          resetPasswordVersion: 0,
        });
        exportedRecords.push({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            password: DEFAULT_PASSWORD,
            phone: user.phone,
            role: user.role,
            fatherName: user.fatherName,
            fatherCnic: user.fatherCnic,
            address: user.address,
            age: user.age,
            dateOfBirth: user.dateOfBirth,
            gender: user.gender,
            diagnosis: user.diagnosis,
            packageId: user.packageId,
            monthlyAmount: child.monthlyAmount,
            isActive: user.isActive,
            });

        console.log(
          `CREATED: ${user.fullName} | ${user.email} | CNIC: ${child.fatherCnic} | Package: ${packageId || "Not Assigned"}`
        );

        created++;
      } catch (error) {
        console.error(
          `FAILED: ${child.fullName}: ${error.message}`
        );

        failed++;
      }
      saveStudentsToJson(exportedRecords);
    }

    console.log("\n========== IMPORT SUMMARY ==========");
    console.log(`Total Students: ${children.length}`);
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Packages Created/Updated: ${Object.keys(packageMap).length}`);
    console.log("====================================");

  } catch (error) {
    console.error("Import error:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("MongoDB disconnected");
    }
  }
}

createChildUsers();