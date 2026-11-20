const express = require("express");
const router = express.Router();
const {
  getConversations,
  getMessages,
  sendMessage,
  markAsSeen,
  getUnreadSummary,
  deleteConversation,
  getConversationId,
  getConversationsLastSeen,
} = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/requirePermission");

router.get("/conversations", protect, requirePermission("chat"),getConversations);
router.get("/conversations/last_seen/:userID", protect, requirePermission("chat"),getConversationsLastSeen);
router.get("/messages/:conversationId", protect, requirePermission("chat"),getMessages);
router.post("/messages", protect, requirePermission("chat"),sendMessage);
router.post("/messages/mark-as-seen", protect, requirePermission("chat"),markAsSeen);
router.get("/unread-summary", protect, requirePermission("chat"),getUnreadSummary);
router.get("/:senderId/:receiverId/conversation-id", protect, requirePermission("chat"),getConversationId);
router.delete("/conversations/:conversationId", protect, requirePermission("chat"),deleteConversation);
module.exports = router;
