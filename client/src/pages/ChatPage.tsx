import React, { useState, useEffect, useCallback, useRef } from "react";
import { User, Message } from "../types";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { api } from "../api/axios";
import { Sidebar } from "../components/chat/Sidebar";
import { ChatWindow } from "../components/chat/ChatWindow";
import { EmptyState } from "../components/chat/EmptyState";
import { toast } from "sonner";
import { playNotificationChime } from "../utils/sound";

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

  const usersRef = useRef<User[]>([]);
  usersRef.current = users;

  // Request browser desktop notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Sync dynamic document title with total unread messages
  useEffect(() => {
    const totalUnread = users.reduce((acc, u) => acc + (u.unreadCount || 0), 0);
    document.title =
      totalUnread > 0 ? `(${totalUnread}) New Messages | LiveChat` : "LiveChat";
  }, [users]);

  // 1. Fetch user directory & sort by most recent interaction
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get<{ users: User[] }>("/users");
      const sorted = response.data.users.sort((a, b) => {
        const timeA = a.lastMessage?.createdAt
          ? new Date(a.lastMessage.createdAt).getTime()
          : 0;
        const timeB = b.lastMessage?.createdAt
          ? new Date(b.lastMessage.createdAt).getTime()
          : 0;
        return timeB - timeA;
      });
      setUsers(sorted);
    } catch (err) {
      console.error("[ChatPage] Failed to fetch users:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 2. Fetch conversation history when selecting a user
  const handleSelectUser = useCallback(
    async (user: User) => {
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
    },
    [socket]
  );

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
      } else if (newMsg.receiver === currentUser?.id) {
        // Chat is NOT open for this sender! Trigger popup toast & chime without refresh
        const senderUser = usersRef.current.find((u) => u.id === newMsg.sender);
        const senderName = senderUser?.name || "New Message";

        // Play gentle audio chime
        playNotificationChime();

        // 1. In-App Sonner Popup Toast with 1-click open
        toast.custom(
          (t) => (
            <div
              onClick={() => {
                if (senderUser) {
                  handleSelectUser(senderUser);
                } else {
                  fetchUsers();
                }
                toast.dismiss(t);
              }}
              className="w-80 md:w-96 bg-[#121215] border border-[#27272a] hover:border-[#10b981] rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] backdrop-blur-xl group select-none"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-inner group-hover:ring-2 group-hover:ring-[#10b981]/50 transition-all"
                style={{ backgroundColor: senderUser?.avatarColor || "#10b981" }}
              >
                {senderName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#fafafa] truncate">
                    {senderName}
                  </span>
                  <span className="text-[10px] text-[#71717a] font-mono-numbers">
                    now
                  </span>
                </div>
                <p className="text-[11px] text-[#a1a1aa] truncate mt-0.5 font-normal">
                  {newMsg.content}
                </p>
              </div>
              <span className="text-[11px] font-medium text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-[#10b981] group-hover:text-[#09090b] transition-colors">
                Reply
              </span>
            </div>
          ),
          { duration: 5000 }
        );

        // 2. Native OS / Desktop Notification (when browser tab is minimized or in background)
        if (
          document.hidden &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            const notif = new Notification(senderName, {
              body: newMsg.content,
              icon: "/favicon.ico",
            });
            notif.onclick = () => {
              window.focus();
              if (senderUser) handleSelectUser(senderUser);
              notif.close();
            };
          } catch {
            // Notification permission or policy error
          }
        }
      }

      // Update user list item snippet & reorder so active chat jumps to the top
      setUsers((prev) => {
        const otherUserId =
          newMsg.sender === currentUser?.id ? newMsg.receiver : newMsg.sender;

        const exists = prev.some((u) => u.id === otherUserId);
        let updatedList: User[];

        if (!exists) {
          fetchUsers();
          return prev;
        } else {
          updatedList = prev.map((u) => {
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
        }

        // Sort by most recent interaction descending
        return updatedList.sort((a, b) => {
          const timeA = a.lastMessage?.createdAt
            ? new Date(a.lastMessage.createdAt).getTime()
            : 0;
          const timeB = b.lastMessage?.createdAt
            ? new Date(b.lastMessage.createdAt).getTime()
            : 0;
          return timeB - timeA;
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
