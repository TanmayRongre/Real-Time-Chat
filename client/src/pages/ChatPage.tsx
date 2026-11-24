import React, { useState, useEffect, useCallback, useRef } from "react";
import { User, Message } from "../types";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { api } from "../api/axios";
import { Sidebar } from "../components/chat/Sidebar";
import { ChatWindow } from "../components/chat/ChatWindow";
import { EmptyState } from "../components/chat/EmptyState";
import { toast } from "sonner";

export const ChatPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { socket, isConnected } = useSocket();

  const [users, setUsers] = useState<User[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);

  const activeUserRef = useRef<User | null>(null);
  activeUserRef.current = activeUser;

  // 1. Fetch user directory
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get<{ users: User[] }>("/users");
      setUsers(response.data.users);
    } catch (err) {
      console.error("[ChatPage] Failed to fetch users:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 2. Fetch conversation history when selecting a user
  const handleSelectUser = async (user: User) => {
    setActiveUser(user);
    setIsRecipientTyping(false);
    setLoadingMessages(true);

    try {
      const response = await api.get<{
        conversation: { id: string };
        messages: Message[];
      }>(`/conversations/${user.id}/messages`);

      const convId = response.data.conversation.id;
      setConversationId(convId);
      setMessages(response.data.messages);

      // Reset unread count locally for this user
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, unreadCount: 0 } : u))
      );

      // Notify server that messages have been read
      if (socket && convId) {
        socket.emit("messages:read", {
          conversationId: convId,
          senderId: user.id,
        });
      }
    } catch (err) {
      console.error("[ChatPage] Failed to load messages:", err);
      toast.error("Failed to load message history");
    } finally {
      setLoadingMessages(false);
    }
  };

  // 3. Send message via Socket.io
  const handleSendMessage = (content: string) => {
    if (!socket || !activeUser || !currentUser) return;

    socket.emit(
      "message:send",
      {
        receiverId: activeUser.id,
        content,
      },
      (res: { success?: boolean; error?: string; message?: Message }) => {
        if (res?.error) {
          toast.error(res.error);
        }
      }
    );
  };

  // Typing indicators
  const handleTypingStart = () => {
    if (socket && activeUser) {
      socket.emit("typing:start", { receiverId: activeUser.id });
    }
  };

  const handleTypingStop = () => {
    if (socket && activeUser) {
      socket.emit("typing:stop", { receiverId: activeUser.id });
    }
  };

  // 4. Socket Listeners for Real-Time Events
  useEffect(() => {
    if (!socket) return;

    // A. Receive incoming or synced message
    const handleMessageReceive = (newMsg: Message) => {
      const currentActive = activeUserRef.current;
      const isForActiveConversation =
        currentActive &&
        (newMsg.sender === currentActive.id || newMsg.receiver === currentActive.id);

      if (isForActiveConversation) {
        setMessages((prev) => {
          // Avoid duplicate additions
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // If current user is receiver, emit read receipt immediately
        if (newMsg.receiver === currentUser?.id && newMsg.conversationId) {
          socket.emit("messages:read", {
            conversationId: newMsg.conversationId,
            senderId: newMsg.sender,
          });
        }
      }

      // Update user list item snippet
      setUsers((prev) => {
        const otherUserId =
          newMsg.sender === currentUser?.id ? newMsg.receiver : newMsg.sender;

        return prev.map((u) => {
          if (u.id === otherUserId) {
            const isCurrentlyActive = currentActive?.id === otherUserId;
            const newUnread =
              !isCurrentlyActive && newMsg.receiver === currentUser?.id
                ? (u.unreadCount || 0) + 1
                : 0;

            return {
              ...u,
              lastMessage: {
                content: newMsg.content,
                createdAt: newMsg.createdAt,
                sender: newMsg.sender,
              },
              unreadCount: newUnread,
            };
          }
          return u;
        });
      });
    };

    // B. Read Receipts ACK
    const handleReadAck = ({
      conversationId: ackConvId,
      readerId,
    }: {
      conversationId: string;
      readerId: string;
    }) => {
      const currentActive = activeUserRef.current;
      if (currentActive && currentActive.id === readerId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender === currentUser?.id ? { ...m, status: "read" } : m
          )
        );
      }
    };

    // C. Live typing indicators
    const handleTypingStartEvent = ({ senderId }: { senderId: string }) => {
      if (activeUserRef.current?.id === senderId) {
        setIsRecipientTyping(true);
      }
    };

    const handleTypingStopEvent = ({ senderId }: { senderId: string }) => {
      if (activeUserRef.current?.id === senderId) {
        setIsRecipientTyping(false);
      }
    };

    // D. User online status broadcast
    const handleUserStatus = ({
      userId,
      isOnline,
      lastSeen,
    }: {
      userId: string;
      isOnline: boolean;
      lastSeen?: string;
    }) => {
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              isOnline,
              lastSeen: lastSeen || u.lastSeen,
            };
          }
          return u;
        })
      );

      if (activeUserRef.current?.id === userId) {
        setActiveUser((prev) =>
          prev ? { ...prev, isOnline, lastSeen: lastSeen || prev.lastSeen } : null
        );
      }
    };

    socket.on("message:receive", handleMessageReceive);
    socket.on("messages:read_ack", handleReadAck);
    socket.on("typing:start", handleTypingStartEvent);
    socket.on("typing:stop", handleTypingStopEvent);
    socket.on("user:status", handleUserStatus);

    return () => {
      socket.off("message:receive", handleMessageReceive);
      socket.off("messages:read_ack", handleReadAck);
      socket.off("typing:start", handleTypingStartEvent);
      socket.off("typing:stop", handleTypingStopEvent);
      socket.off("user:status", handleUserStatus);
    };
  }, [socket, currentUser?.id]);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#09090b] text-[#fafafa]">
      {/* Sidebar: Visible on desktop or when no conversation is active on mobile */}
      <div
        className={`h-full ${
          activeUser ? "hidden md:flex" : "flex w-full"
        } md:w-80 lg:w-96 shrink-0`}
      >
        <Sidebar
          activeUserId={activeUser?.id || null}
          onSelectUser={handleSelectUser}
          users={users}
          onRefreshUsers={fetchUsers}
        />
      </div>

      {/* Main Chat Workspace: Visible on desktop or when conversation is active on mobile */}
      <div
        className={`flex-1 h-full ${
          !activeUser ? "hidden md:flex" : "flex"
        } flex-col overflow-hidden`}
      >
        {activeUser ? (
          <ChatWindow
            recipient={activeUser}
            conversationId={conversationId}
            messages={messages}
            loadingMessages={loadingMessages}
            onSendMessage={handleSendMessage}
            onBack={() => setActiveUser(null)}
            isRecipientTyping={isRecipientTyping}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
};
