const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const uploadDir = path.join(__dirname, "..", "assets", "broadcasts");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const MIME_TO_TYPE = {
  "application/pdf": "pdf",
  "image/jpeg": "image",
  "image/png": "image",
  "image/jpg": "image",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "doc",
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (MIME_TO_TYPE[file.mimetype]) return cb(null, true);
    cb(new Error("Unsupported file type. Only PDF, image, or doc allowed."));
  },
});

module.exports = { uploadBroadcastAttachment: upload.single("attachment"), MIME_TO_TYPE };