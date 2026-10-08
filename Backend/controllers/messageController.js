const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const mongoose = require("mongoose");

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
    conversation.deletedFor = [];
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

    const conversations = await Conversation.find({
      participants: userId,
      deletedFor: { $ne: userId },
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
          (p) => p._id.toString() !== userId.toString(),
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
      }),
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

exports.getUnreadSummary = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.query.userId;
    const role = req.user?.role || req.query.role;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const userConversations = await Conversation.find({
      participants: userId,
    }).select("_id");

    const conversationIds = userConversations.map((conv) => conv._id);

    if (conversationIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          hasUnread: false,
          totalUnreadCount: 0,
          latestUnreadMessage: null,
          role: role || null,
        },
      });
    }

    const unreadFilter = {
      conversationId: { $in: conversationIds },
      receiver: userId,
      isSeen: false,
    };

    const totalUnreadCount = await Message.countDocuments(unreadFilter);

    let latestUnreadMessage = null;
    if (totalUnreadCount > 0) {
      latestUnreadMessage = await Message.findOne(unreadFilter)
        .sort({ createdAt: -1 })
        .populate({
          path: "sender",
          select: "fullName name profileImage role",
        });
    }

    return res.status(200).json({
      success: true,
      data: {
        hasUnread: totalUnreadCount > 0,
        totalUnreadCount,
        latestUnreadMessage,
        role: role || null,
      },
    });
  } catch (error) {
    console.error("Error in getUnreadSummary:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error fetching unread summary",
      error: error.message,
    });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
    }

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: conversationId,
        participants: userId,
      },
      {
        $addToSet: {
          deletedFor: userId,
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
      data: {
        conversationId,
      },
    });
  } catch (error) {
    console.error("Delete conversation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete conversation",
      error: error.message,
    });
  }
};
