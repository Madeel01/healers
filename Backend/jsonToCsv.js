
const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "exports", "new-children.json");
const outputFile = path.join(__dirname, "exports", "new-children.csv");

function escapeCsv(value) {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    value = value.toISOString();
  }

  if (typeof value === "object") {
    value = JSON.stringify(value);
  }

  return `"${String(value).replace(/"/g, '""')}"`;
}

function jsonToCsv() {
  try {
    if (!fs.existsSync(inputFile)) {
      throw new Error("JSON file not found: " + inputFile);
    }

    const records = JSON.parse(
      fs.readFileSync(inputFile, "utf8")
    );

    if (!Array.isArray(records) || records.length === 0) {
      throw new Error("JSON file is empty or invalid.");
    }

    // Collect all columns dynamically
    const headers = [
      ...new Set(records.flatMap((record) => Object.keys(record))),
    ];

    const csvRows = [
      headers.map(escapeCsv).join(","),

      ...records.map((record) =>
        headers
          .map((header) => escapeCsv(record[header]))
          .join(",")
      ),
    ];

    // UTF-8 BOM helps Excel display text correctly
    fs.writeFileSync(
      outputFile,
      "\uFEFF" + csvRows.join("\n"),
      "utf8"
    );

    console.log("CSV generated successfully!");
    console.log("Total records:", records.length);
    console.log("Output:", outputFile);

  } catch (error) {
    console.error("CSV Export Error:", error.message);
  }
}

jsonToCsv();
