
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const User = require("../models/User");
const TherapistAssignment = require("../models/TherapistAssignment");

// ======================================
// CONFIGURATION
// ======================================

const OUTPUT_FILE = path.join(
  __dirname,
  "therapist-credentials.json"
);

// ======================================
// THERAPISTS DATA
// ======================================

const therapists = [
  {
    name: "Miss Hafsa",
    email: "hafsajamil55@gmail.com",
  },
  {
    name: "Miss Shazmeena",
    email: "anmolkhan19998@gmail.com",
  },
  {
    name: "Miss Shayana",
    email: "meshikhan1313@gmail.com",
  },
  {
    name: "Miss Rabia",
    email: "nrasubhan3@gmail.com",
  },
  {
    name: "Miss Amna",
    email: "amnab2246@gmail.com",
  },
  {
    name: "Miss Uzma",
    email: "Uzma48286@gmail.com",
  },
  {
    name: "Miss Naheed",
    email: "ayaz46kh47an@gmail.com",
  },
  {
    name: "Miss Ghazala",
    email: "alijanmm792@gmail.com",
  },
  {
    name: "Miss Faiza",
    email: "fayzaqazi7@gmail.com",
  },
];

// ======================================
// GENERATE STRONG RANDOM PASSWORD
// ======================================

function generatePassword(length = 14) {
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const special = "!@#$%^&*";

  const all = lowercase + uppercase + numbers + special;

  const getRandom = (chars) =>
    chars[crypto.randomInt(0, chars.length)];

  const password = [
    getRandom(lowercase),
    getRandom(uppercase),
    getRandom(numbers),
    getRandom(special),
  ];

  while (password.length < length) {
    password.push(getRandom(all));
  }

  // Secure shuffle
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}

// ======================================
// SAVE CREDENTIALS TO JSON
// ======================================

function saveCredentials(newCredentials) {
  let existingCredentials = [];

  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existingCredentials = JSON.parse(
        fs.readFileSync(OUTPUT_FILE, "utf8")
      );
    } catch {
      throw new Error(
        "Could not read existing credentials file. Backup it before continuing."
      );
    }
  }

  const credentialsMap = new Map(
    existingCredentials.map((item) => [
      item.email.toLowerCase(),
      item,
    ])
  );

  for (const item of newCredentials) {
    credentialsMap.set(item.email.toLowerCase(), item);
  }

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify([...credentialsMap.values()], null, 2),
    { mode: 0o600 }
  );
}

// ======================================
// MAIN SEEDER
// ======================================

async function seedTherapists() {
  let connected = false;

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    connected = true;

    console.log("Connected to MongoDB\n");

    let created = 0;
    let skipped = 0;
    let failed = 0;

    const generatedCredentials = [];

    for (const therapist of therapists) {
      const email = therapist.email.trim().toLowerCase();

      try {
        // Check existing user
        const existingUser = await User.findOne({ email });

        if (existingUser) {
          console.log(
            `SKIPPED: ${therapist.name} | ${email} already exists`
          );
          skipped++;
          continue;
        }

        // Generate unique password
        const password = generatePassword();

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create therapist user
        const user = await User.create({
          fullName: therapist.name,
          email,
          password: hashedPassword,

          phone: "",
          role: "Therapist",
          permissions: [],

          biometricKey:
            "bio-" +
            Date.now() +
            "-" +
            crypto.randomBytes(5).toString("hex"),

          agreeTerms: true,
          isLogin: false,

          fatherName: "",
          fatherCnic: "",
          address: "",
          age: null,

          gender: null,
          diagnosis: "",

          isOnline: false,
          lastActive: null,
          profileImage: "",

          isActive: true,
          pushTokens: [],
          resetPasswordVersion: 0,
        });

        // Create therapist assignment
        try {
          
          console.log(
            `CREATED: ${therapist.name} | ${email}`
          );

          generatedCredentials.push({
            name: therapist.name,
            email: user.email,
            password,
            role: "Therapist",
          });

          created++;
        } catch (assignmentError) {
          // Avoid leaving an orphaned user if assignment fails
          await User.deleteOne({ _id: user._id });
          throw assignmentError;
        }
      } catch (error) {
        console.error(
          `FAILED: ${therapist.name} | ${error.message}`
        );
        failed++;
      }
    }

    // Save plaintext credentials securely for sharing
    if (generatedCredentials.length > 0) {
      saveCredentials(generatedCredentials);
    }

    console.log("\n========== IMPORT SUMMARY ==========");
    console.log(`Total:   ${therapists.length}`);
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed:  ${failed}`);

    if (generatedCredentials.length > 0) {
      console.log("\nCredentials saved successfully!");
      console.log(OUTPUT_FILE);
    }

  } catch (error) {
    console.error("Seeder Error:", error.message);
    process.exitCode = 1;
  } finally {
    if (connected) {
      await mongoose.disconnect();
      console.log("\nMongoDB disconnected.");
    }
  }
}

seedTherapists();
