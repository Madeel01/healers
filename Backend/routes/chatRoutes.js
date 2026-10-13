const express = require("express");
const router = express.Router();
const {
  getConversations,
  getMessages,
  sendMessage,
  markAsSeen,
  getUnreadSummary,
  deleteConversation,
  getConversationId
} = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");

router.get("/conversations", protect, getConversations);
router.get("/messages/:conversationId", protect, getMessages);
router.post("/messages", protect, sendMessage);
router.post("/messages/mark-as-seen", protect, markAsSeen);
router.get("/unread-summary", protect, getUnreadSummary);
router.get("/:senderId/:receiverId/conversation-id", protect,getConversationId);
router.delete("/conversations/:conversationId", protect, deleteConversation);
module.exports = router;
