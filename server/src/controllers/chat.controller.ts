import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middlewares/auth.middleware";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { User } from "../models/User";

export const getConversationMessages = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = req.userId;
    const { userId: targetUserId } = req.params;

    if (!currentUserId) {
      res.status(401).json({ error: "Unauthorized access" });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: "Invalid user ID format" });
      return;
    }

    if (currentUserId === targetUserId) {
      res.status(400).json({ error: "Cannot create conversation with yourself" });
      return;
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId).select("_id name email avatarColor isOnline lastSeen");
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, targetUserId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, targetUserId],
      });
    }

    // Mark messages received from targetUser as read
    await Message.updateMany(
      {
        conversationId: conversation._id,
        sender: targetUserId,
        receiver: currentUserId,
        status: { $ne: "read" },
      },
      { $set: { status: "read" } }
    );

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const totalMessages = await Message.countDocuments({
      conversationId: conversation._id,
    });

    const messages = await Message.find({
      conversationId: conversation._id,
    })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedMessages = messages.map((m) => ({
      id: m._id.toString(),
      conversationId: m.conversationId.toString(),
      sender: m.sender.toString(),
      receiver: m.receiver.toString(),
      content: m.content,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));

    res.status(200).json({
      conversation: {
        id: conversation._id.toString(),
        participants: conversation.participants.map((p) => p.toString()),
        lastMessage: conversation.lastMessage ? conversation.lastMessage.toString() : null,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      },
      targetUser: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        avatarColor: targetUser.avatarColor,
        isOnline: targetUser.isOnline,
        lastSeen: targetUser.lastSeen.toISOString(),
      },
      pagination: {
        page,
        limit,
        total: totalMessages,
        hasMore: skip + messages.length < totalMessages,
      },
      messages: formattedMessages,
    });
  } catch (error) {
    console.error("[getConversationMessages Error]", error);
    res.status(500).json({ error: "Failed to retrieve conversation messages" });
  }
};
