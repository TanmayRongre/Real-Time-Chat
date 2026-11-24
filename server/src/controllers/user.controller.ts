import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { User } from "../models/User";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";

export const getUsers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      res.status(401).json({ error: "Unauthorized access" });
      return;
    }

    const search = (req.query.q as string)?.trim();

    // Query excluding current authenticated user
    const query: Record<string, unknown> = {
      _id: { $ne: currentUserId },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("_id name email avatarColor isOnline lastSeen createdAt")
      .sort({ isOnline: -1, lastSeen: -1, name: 1 })
      .lean();

    // Fetch conversation snippets & unread counts for each user
    const usersWithConversations = await Promise.all(
      users.map(async (u) => {
        const conversation = await Conversation.findOne({
          participants: { $all: [currentUserId, u._id], $size: 2 },
        }).populate("lastMessage");

        let lastMessageData = null;
        let unreadCount = 0;

        if (conversation) {
          if (conversation.lastMessage) {
            const lm = conversation.lastMessage as any;
            lastMessageData = {
              id: lm._id?.toString(),
              content: lm.content,
              createdAt: lm.createdAt?.toISOString(),
              sender: lm.sender?.toString(),
            };
          }

          unreadCount = await Message.countDocuments({
            conversationId: conversation._id,
            receiver: currentUserId,
            status: { $ne: "read" },
          });
        }

        return {
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          avatarColor: u.avatarColor,
          isOnline: u.isOnline,
          lastSeen: u.lastSeen?.toISOString(),
          createdAt: u.createdAt?.toISOString(),
          conversationId: conversation?._id?.toString() || null,
          lastMessage: lastMessageData,
          unreadCount,
        };
      }),
    );

    // Sort by latest message date if present, otherwise online status and lastSeen
    usersWithConversations.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      const timeB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;
      if (timeA && timeB) return timeB - timeA;
      if (timeA) return -1;
      if (timeB) return 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return (
        new Date(b.lastSeen || 0).getTime() -
        new Date(a.lastSeen || 0).getTime()
      );
    });

    res.status(200).json({
      users: usersWithConversations,
    });
  } catch (error) {
    console.error("[getUsers Error]", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

