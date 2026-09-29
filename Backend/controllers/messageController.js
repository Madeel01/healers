const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

exports.sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, text } = req.body;

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      sender: senderId,
      receiver: receiverId,
      text,
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const skip = (page - 1) * limit;

    // Fetch all user conversations sorted by most recent activity
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate({
        path: "participants",
        select: "fullName profileImage role isOnline lastActive",
      })
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    const formattedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const partner = conv.participants.find(
          (p) => p._id.toString() !== userId.toString()
        );

        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          receiver: userId,
          isSeen: false,
        });

        return {
          conversationId: conv._id,
          partner: {
            id: partner?._id,
            fullName: partner?.fullName,
            profileImage: partner?.profileImage,
            role: partner?.role,
            lastActive: partner?.lastActive,
            isOnline: partner?.isOnline || false,
          },
          lastMessage: conv.lastMessage
            ? {
                text: conv.lastMessage.text,
                createdAt: conv.lastMessage.createdAt,
                isSeen: conv.lastMessage.isSeen,
                sender: conv.lastMessage.sender,
              }
            : null,
          unreadCount,
          isCareTeam: conv.isCareTeam,
          updatedAt: conv.updatedAt,
        };
      })
    );

    // Sort: Unread conversations first, then by last updated date
    formattedConversations.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    // Apply pagination after sorting
    const paginatedConversations = formattedConversations.slice(skip, skip + limit);

    res.status(200).json({ success: true, data: paginatedConversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.markAsSeen = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    await Message.updateMany(
      { conversationId, receiver: userId, isSeen: false },
      { $set: { isSeen: true, seenAt: new Date() } },
    );

    res.status(200).json({ success: true, message: "Messages marked as seen" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
