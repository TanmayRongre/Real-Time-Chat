import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { User } from "../models/User";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { TokenPayload } from "../middlewares/auth.middleware";

// Extend Socket to include authenticated userId
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

// Validation schema for incoming messages
const messageSendSchema = z.object({
  receiverId: z.string().min(1, "Receiver ID is required"),
  content: z.string().trim().min(1, "Message content cannot be empty").max(2000, "Message cannot exceed 2000 characters"),
});

// Map of userId -> Set of active socket IDs (supports multiple tabs / devices)
const userSocketsMap = new Map<string, Set<string>>();

export const registerChatSockets = (io: Server): void => {
  // 1. Socket Authentication Middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication failed: No token provided"));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      if (!decoded || !decoded.userId) {
        return next(new Error("Authentication failed: Invalid token payload"));
      }

      socket.userId = decoded.userId;
      socket.userEmail = decoded.email;
      next();
    } catch (error) {
      console.error("[Socket Auth Error]", error);
      next(new Error("Authentication failed: Unauthorized"));
    }
  });

  // 2. Connection Handler
  io.on("connection", async (socket: AuthenticatedSocket) => {
    const userId = socket.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Add socket to user's set of connections
    const currentSockets = userSocketsMap.get(userId) || new Set<string>();
    currentSockets.add(socket.id);
    userSocketsMap.set(userId, currentSockets);

    // Join personal user room for direct messaging
    socket.join(userId);

    // Update database status: User is online
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
    } catch (err) {
      console.error("[Socket DB Update Error] Failed to set user online:", err);
    }

    // Send the list of all currently online user IDs to the connected client
    const onlineUserIds = Array.from(userSocketsMap.keys());
    socket.emit("users:online", onlineUserIds);

    // Broadcast user online status to all other connected clients
    socket.broadcast.emit("user:status", {
      userId,
      isOnline: true,
      lastSeen: new Date(),
    });

    console.log(`[Socket] User ${userId} connected (Socket: ${socket.id}). Active users: ${userSocketsMap.size}`);

    // 3. Handle message:send
    socket.on("message:send", async (data: unknown, callback?: (res: any) => void) => {
      try {
        const parsed = messageSendSchema.safeParse(data);
        if (!parsed.success) {
          if (callback) callback({ error: parsed.error.errors[0].message });
          return;
        }

        const { receiverId, content } = parsed.data;

        if (receiverId === userId) {
          if (callback) callback({ error: "Cannot send message to yourself" });
          return;
        }

        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
          if (callback) callback({ error: "Receiver does not exist" });
          return;
        }

        // Find or create Conversation between sender and receiver
        let conversation = await Conversation.findOne({
          participants: { $all: [userId, receiverId], $size: 2 },
        });

        if (!conversation) {
          conversation = await Conversation.create({
            participants: [userId, receiverId],
          });
        }

        // Determine delivery status
        const isReceiverOnline = userSocketsMap.has(receiverId) && (userSocketsMap.get(receiverId)?.size || 0) > 0;
        const initialStatus: "sent" | "delivered" = isReceiverOnline ? "delivered" : "sent";

        // Save Message in MongoDB
        const newMessage = await Message.create({
          conversationId: conversation._id,
          sender: userId,
          receiver: receiverId,
          content,
          status: initialStatus,
        });

        // Update Conversation lastMessage
        conversation.lastMessage = newMessage._id;
        await conversation.save();

        const formattedMessage = {
          id: newMessage._id.toString(),
          conversationId: conversation._id.toString(),
          sender: userId,
          receiver: receiverId,
          content: newMessage.content,
          status: newMessage.status,
          createdAt: newMessage.createdAt.toISOString(),
          updatedAt: newMessage.updatedAt.toISOString(),
        };

        // Emit message to receiver's room
        io.to(receiverId).emit("message:receive", formattedMessage);

        // Also emit back to all of the sender's sockets (sync across tabs)
        io.to(userId).emit("message:receive", formattedMessage);

        if (callback) {
          callback({ success: true, message: formattedMessage });
        }
      } catch (err) {
        console.error("[Socket message:send Error]", err);
        if (callback) callback({ error: "Failed to send message" });
      }
    });

    // 4. Handle typing indicators
    socket.on("typing:start", ({ receiverId }: { receiverId: string }) => {
      if (receiverId) {
        io.to(receiverId).emit("typing:start", { senderId: userId });
      }
    });

    socket.on("typing:stop", ({ receiverId }: { receiverId: string }) => {
      if (receiverId) {
        io.to(receiverId).emit("typing:stop", { senderId: userId });
      }
    });

    // 5. Handle messages:read
    socket.on("messages:read", async ({ conversationId, senderId }: { conversationId: string; senderId: string }) => {
      try {
        if (!conversationId || !senderId) return;

        // Update all unread messages from senderId to current user in this conversation
        const updateResult = await Message.updateMany(
          {
            conversationId,
            sender: senderId,
            receiver: userId,
            status: { $ne: "read" },
          },
          { $set: { status: "read" } }
        );

        if (updateResult.modifiedCount > 0) {
          // Notify sender that messages have been read
          io.to(senderId).emit("messages:read_ack", {
            conversationId,
            readerId: userId,
          });
        }
      } catch (err) {
        console.error("[Socket messages:read Error]", err);
      }
    });

    // 6. Handle Disconnect
    socket.on("disconnect", async () => {
      const userSockets = userSocketsMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userSocketsMap.delete(userId);

          // Persist user offline status and update lastSeen
          const now = new Date();
          try {
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastSeen: now,
            });
          } catch (err) {
            console.error("[Socket Disconnect DB Error]", err);
          }

          // Broadcast user status to all clients
          socket.broadcast.emit("user:status", {
            userId,
            isOnline: false,
            lastSeen: now,
          });

          console.log(`[Socket] User ${userId} disconnected completely. Remaining active users: ${userSocketsMap.size}`);
        }
      }
    });
  });
};
