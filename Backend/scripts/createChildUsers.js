
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const EMAIL_DOMAIN = "gmail.com";
const DEFAULT_PASSWORD = "test@123";

const children = [
  {
    fullName: "Hassan Abdullah",
    fatherName: "Muhammad Zubair",
    address: "Topi",
    gender: "Male",
    diagnosis: "Autistic",
    dateOfBirth: "2016-09-07",
    discountedPrice: 32500,
    phone: "03229950208",
    age: 10,
  },
  {
    fullName: "Abdul Ghani khan",
    fatherName: "M Jawad Khan",
    address: "Darra Swabi",
    gender: "Male",
    diagnosis: "Down Syndrom",
    dateOfBirth: "2022-11-03",
    discountedPrice: 32500,
    phone: "03329040950",
    age: 3,
  },
  {
    fullName: "Salahudin Bilal",
    fatherName: "Bilal Raheem",
    address: "Darra Swabi",
    gender: "Male",
    diagnosis: "Autistic",
    dateOfBirth: "2020-05-04",
    discountedPrice: 22500,
    phone: "03142632381",
    age: 5,
  },
  {
    fullName: "Ibad Ur Rehman",
    fatherName: "Naveed Shah",
    address: "Tpoi",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: "2020-07-27",
    discountedPrice: 22500,
    phone: "31229000504",
    age: 5,
  },
  {
    fullName: "Eman Raza",
    fatherName: "Asif Raza",
    address: "Town",
    gender: "Female",
    diagnosis: "Speech Delay",
    dateOfBirth: "2018-09-01",
    discountedPrice: 22000,
    phone: "03451999952",
    age: 7,
  },
  {
    fullName: "Horiya Gul",
    fatherName: "Istiraj Khan",
    address: "KSK Razar",
    gender: "Female",
    diagnosis: "Speech Delay",
    dateOfBirth: "2017-09-04",
    discountedPrice: 22500,
    phone: "12899283495",
    age: 8,
  },
  {
    fullName: "Reyan Basur",
    fatherName: "Basur Ali",
    address: "Haryan lahor",
    gender: "Male",
    diagnosis: "Deaf",
    dateOfBirth: "2014-06-01",
    discountedPrice: 22500,
    phone: "03151206424",
    age: 12,
  },
  {
    fullName: "Muhammad Mustafa",
    fatherName: "Manzor Ali Bacha",
    address: "Karachi",
    gender: "Male",
    diagnosis: "Autistic",
    dateOfBirth: "2019-09-07",
    discountedPrice: 25000,
    phone: "03083561130",
    age: 7,
  },
  {
    fullName: "Azhar Nawaz",
    fatherName: "Muhammad Nawaz",
    address: "Maneri",
    gender: "Male",
    diagnosis: "Autistic",
    dateOfBirth: "2014-12-02",
    discountedPrice: 35000,
    phone: "44747430494",
    age: 11,
  },
  {
    fullName: "Muhammad Arman",
    fatherName: "Asmat Ali",
    address: "Shahmansor",
    gender: "Male",
    diagnosis: "GDD & ASD",
    dateOfBirth: "2017-01-01",
    discountedPrice: 30000,
    phone: "971508148651",
    age: 9,
  },
  {
    fullName: "Muaz Ali khan",
    fatherName: "Amir Ali khan",
    address: "Maneri",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: "2021-12-09",
    discountedPrice: 32500,
    phone: "03339235366",
    age: 4,
  },
  {
    fullName: "Muhammad Bilal",
    fatherName: "Aziz ul Hassan",
    address: "Zaida",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: "2021-09-10",
    discountedPrice: 7500,
    phone: "00565770934",
    age: 4,
  },
  {
    fullName: "Hareem Ashfaq",
    fatherName: "Ashfaq Ahmad",
    address: "Panjman",
    gender: "Female",
    diagnosis: "Delay",
    dateOfBirth: "2018-08-08",
    discountedPrice: 15000,
    phone: "03444448299",
    age: 7,
  },
  {
    fullName: "Warda Ashfaq",
    fatherName: "Ashfaq Ahmad",
    address: "Panjman",
    gender: "Female",
    diagnosis: "Delay",
    dateOfBirth: "2023-08-01",
    discountedPrice: 15000,
    phone: "03444448299",
    age: 3,
  },
  {
    fullName: "Manahel Ashfaq",
    fatherName: "Ashfaq Ahmad",
    address: "Panjman",
    gender: "Female",
    diagnosis: "",
    dateOfBirth: "2011-08-08",
    discountedPrice: 15000,
    phone: "03444448299",
    age: 14,
  },
  {
    fullName: "Jabran Ashfaq",
    fatherName: "Ashfaq Ahmad",
    address: "Panjman",
    gender: "Male",
    diagnosis: "Delay",
    dateOfBirth: "2015-11-07",
    discountedPrice: 10000,
    phone: "03444448299",
    age: 10,
  },
  {
    fullName: "Rehman Amir",
    fatherName: "DR Amir",
    address: "Shahmansor",
    gender: "Female",
    diagnosis: "ADHA",
    dateOfBirth: "2022-06-03",
    discountedPrice: 31000,
    phone: "03325428893",
    age: 3,
  },
  {
    fullName: "Affan Khan",
    fatherName: "Imran khan",
    address: "Maneri",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: "2022-01-16",
    discountedPrice: 32000,
    phone: "03005887345",
    age: 3,
  },
  {
    fullName: "Yaman",
    fatherName: "Hasan Muhammad",
    address: "Thand Kohi",
    gender: "Male",
    diagnosis: "",
    dateOfBirth: null,
    discountedPrice: 25000,
    phone: "96597423193",
    age: 0,
  },
];

function createEmail(fullName, fatherName) {
  const firstName = fullName.trim().split(/\s+/)[0];

  const username = `${firstName}.${fatherName}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return `${username}@${EMAIL_DOMAIN}`.toLowerCase();
}

async function createChildUsers() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    if (!EMAIL_DOMAIN || !DEFAULT_PASSWORD) {
      throw new Error(
        "Set CHILD_EMAIL_DOMAIN and CHILD_DEFAULT_PASSWORD in .env"
      );
    }

    if (DEFAULT_PASSWORD.length < 8) {
      throw new Error("Default password must be at least 8 characters.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const child of children) {
      try {
        const email = createEmail(child.fullName, child.fatherName);

        const existing = await User.findOne({ email });

        if (existing) {
          console.log(`SKIPPED: ${email} already exists`);
          skipped++;
          continue;
        }

        const user = await User.create({
          fullName: child.fullName,
          email,
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
          fatherCnic: "",
          address: child.address,
          age: child.age,
          dateOfBirth: child.dateOfBirth
            ? new Date(`${child.dateOfBirth}T00:00:00.000Z`)
            : null,
          gender: child.gender,
          diagnosis: child.diagnosis,
          discountedPrice: child.discountedPrice,

          isOnline: false,
          lastActive: null,
          profileImage: "",
          isActive: true,
          pushTokens: [],
          resetPasswordVersion: 0,
        });

        console.log(`CREATED: ${user.fullName} | ${user.email}`);
        created++;
      } catch (error) {
        console.error(`FAILED: ${child.fullName}: ${error.message}`);
        failed++;
      }
    }

    console.log("\n===== IMPORT SUMMARY =====");
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed:  ${failed}`);
  } catch (error) {
    console.error("Import error:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

createChildUsers();
