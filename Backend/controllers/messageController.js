const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

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

exports.getConversations = async (req, res) => {
  try {
    const userId = req.params.userId;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate({
        path: "participants",
        select: "fullName profileImage role isOnline designation",
      })
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    const formattedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const partner = conv.participants.find(
          (p) => p._id.toString() !== userId
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
            designation: partner?.designation || partner?.role,
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
        };
      })
    );

    res.status(200).json({ success: true, data: formattedConversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.markAsSeen = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    await Message.updateMany(
      { conversationId, receiver: userId, isSeen: false },
      { $set: { isSeen: true, seenAt: new Date() } }
    );

    res.status(200).json({ success: true, message: "Messages marked as seen" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateOnlineStatus = async (req, res) => {
  try {
    const { userId, isOnline } = req.body;

    await User.findByIdAndUpdate(userId, { isOnline });

    res.status(200).json({ success: true, isOnline });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};