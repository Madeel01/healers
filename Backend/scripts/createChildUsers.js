
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
    fatherCnic:"3500000000000",
    address: "Topi",
    gender: "Male",
    diagnosis: "Autistic",
    dateOfBirth: "2016-09-07",
    phone: "03229950208",
    age: 10,
  },
  {
    fullName: "Abdul Ghani khan",
    fatherName: "M Jawad Khan",
    fatherCnic:"3500000000001",
    address: "Darra Swabi",
    gender: "Male",
    diagnosis: "Down Syndrom",
    dateOfBirth: "2022-11-03",
    phone: "03329040950",
    age: 3,
  },
  {
    fullName: "Salahudin Bilal",
    fatherName: "Bilal Raheem",
    fatherCnic:"3500000000002",
    address: "Darra Swabi",
    gender: "Male",
    diagnosis: "Autistic",
    dateOfBirth: "2020-05-04",
    phone: "03142632381",
    age: 5,
  },
  {
    fullName: "Ibad Ur Rehman",
    fatherName: "Naveed Shah",
    fatherCnic:"3500000000003",
    address: "Tpoi",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: "2020-07-27",
    phone: "03355043196",
    age: 5,
  },
  {
    fullName: "Eman Raza",
    fatherName: "Asif Raza",
    fatherCnic:"3500000000004",
    address: "Town",
    gender: "Female",
    diagnosis: "Speech Delay",
    dateOfBirth: "2018-09-01",
    phone: "03451999952",
    age: 7,
  },
  {
    fullName: "Horiya Gul",
    fatherName: "Istiraj Khan",
    fatherCnic:"3500000000005",
    address: "KSK Razar",
    gender: "Female",
    diagnosis: "Speech Delay",
    dateOfBirth: "2017-04-09",
    phone: "03124867768",
    age: 8,
  },
  {
    fullName: "Reyan Basur",
    fatherName: "Basur Ali",
    fatherCnic:"3500000000006",
    address: "Haryan lahor",
    gender: "Male",
    diagnosis: "Deaf",
    dateOfBirth: "2014-06-01",
    phone: "03151206424",
    age: 12,
  },
  {
    fullName: "Muhammad Mustafa",
    fatherName: "Manzor Ali Bacha",
    fatherCnic:"3500000000007",
    address: "Karachi",
    gender: "Male",
    diagnosis: "Autistic",
    dateOfBirth: "2019-09-07",
    phone: "03083561130",
    age: 7,
  },
  {
    fullName: "Azhar Nawaz",
    fatherName: "Muhammad Nawaz",
    fatherCnic:"3500000000008",
    address: "Maneri",
    gender: "Male",
    diagnosis: "Autistic",
    dateOfBirth: "2014-12-02",
    phone: "03025682690",
    age: 11,
  },
  {
    fullName: "Muhammad Arman",
    fatherName: "Asmat Ali",
    fatherCnic:"3500000000009",
    address: "Shahmansor",
    gender: "Male",
    diagnosis: "GDD & ASD",
    dateOfBirth: "2017-01-01",
    phone: "03255641491",
    age: 9,
  },
  {
    fullName: "Muaz Ali khan",
    fatherName: "Amir Ali khan",
    fatherCnic:"3500000000010",
    address: "Maneri",
    gender: "Male",
    diagnosis: "ASD",
    dateOfBirth: "2021-12-09",
    phone: "03339235366",
    age: 4,
  },
  {
    fullName: "Muhammad Bilal",
    fatherName: "Aziz ul Hassan",
    fatherCnic:"3500000000011",
    address: "Zaida",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: "2021-10-09",
    phone: "03020096069",
    age: 4,
  },
  {
    fullName: "Hareem Ashfaq",
    fatherName: "Ashfaq Ahmad",
    fatherCnic:"3500000000012",
    address: "Panjman",
    gender: "Female",
    diagnosis: "Delay",
    dateOfBirth: "2018-08-08",
    phone: "03444448299",
    age: 7,
  },
  {
    fullName: "Warda Ashfaq",
    fatherName: "Ashfaq Ahmad",
    fatherCnic:"3500000000012",
    address: "Panjman",
    gender: "Female",
    diagnosis: "Delay",
    dateOfBirth: "2023-08-01",
    phone: "03444448299",
    age: 3,
  },
  {
    fullName: "Manahel Ashfaq",
    fatherName: "Ashfaq Ahmad",
    fatherCnic:"3500000000012",
    address: "Panjman",
    gender: "Female",
    diagnosis: "",
    dateOfBirth: "2011-08-08",
    phone: "03444448299",
    age: 14,
  },
  {
    fullName: "Jabran Ashfaq",
    fatherName: "Ashfaq Ahmad",
    fatherCnic:"3500000000012",
    address: "Panjman",
    gender: "Male",
    diagnosis: "Delay",
    dateOfBirth: "2015-11-07",
    phone: "03444448299",
    age: 10,
  },
  {
    fullName: "Rehman Amir",
    fatherName: "DR Amir",
    fatherCnic:"3500000000013",
    address: "Shahmansor",
    gender: "Female",
    diagnosis: "ADHA",
    dateOfBirth: "2022-06-03",
    phone: "03325428893",
    age: 3,
  },
  {
    fullName: "Affan Khan",
    fatherName: "Imran khan",
    fatherCnic:"3500000000014",
    address: "Maneri",
    gender: "Male",
    diagnosis: "ADHD",
    dateOfBirth: "2022-01-16",
    phone: "03005887345",
    age: 3,
  },
  {
    fullName: "Yaman",
    fatherName: "Hasan Muhammad",
    fatherCnic:"3500000000016",
    address: "Thand Kohi",
    gender: "Male",
    diagnosis: "",
    dateOfBirth: null,
    phone: "03489818618",
    age: 0,
  },
];

function createEmail(fullName, fatherName) {
  const childFirstName = fullName.trim().split(/\s+/)[0];
  const fatherFirstName = fatherName.trim().split(/\s+/)[0];

  return `${childFirstName}.${fatherFirstName}@gmail.com`
    .toLowerCase()
    .replace(/[^a-z0-9.@]/g, "");
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
    await User.deleteMany({ role: "Child"});
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
          fatherCnic:child.fatherCnic,
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
