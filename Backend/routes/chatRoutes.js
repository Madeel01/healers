const express = require("express");
const router = express.Router();
const {
  getConversations,
  getMessages,
  sendMessage,
  markAsSeen,
} = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");

router.get("/conversations", protect, getConversations);
router.get("/messages/:conversationId", protect, getMessages);
router.post("/messages", protect, sendMessage);
router.post("/messages/mark-as-seen", protect, markAsSeen);

module.exports = router;
