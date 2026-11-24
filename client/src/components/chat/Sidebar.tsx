import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, LogOut, MessageSquarePlus, Circle } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { User } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { api } from "../../api/axios";
import { formatRelativeTime } from "../../utils/date";
import { cn } from "../../utils/cn";

interface SidebarProps {
  activeUserId: string | null;
  onSelectUser: (user: User) => void;
  users: User[];
  onRefreshUsers: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeUserId,
  onSelectUser,
  users,
}) => {
  const { user: currentUser, logout } = useAuth();
  const { onlineUsers } = useSocket();
  const [searchQuery, setSearchQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // GSAP animation for initial list render
  useGSAP(
    () => {
      if (users.length > 0) {
        gsap.from(".user-list-item", {
          opacity: 0,
          y: 8,
          stagger: 0.03,
          duration: 0.35,
          ease: "power2.out",
        });
      }
    },
    { scope: listRef, dependencies: [users.length] }
  );

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <aside className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-[#121215] border-r border-[#27272a] select-none">
      {/* Top Bar: Current User Profile & Controls */}
      <div className="h-16 px-4 border-b border-[#27272a] flex items-center justify-between bg-[#121215]/80 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs text-white shadow-sm"
              style={{ backgroundColor: currentUser?.avatarColor || "#10b981" }}
            >
              {currentUser?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10b981] ring-2 ring-[#121215]" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-[#fafafa] truncate">
              {currentUser?.name}
            </span>
            <span className="text-[11px] text-[#71717a] font-mono-numbers truncate">
              {currentUser?.email}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign out"
          className="p-2 rounded-lg text-[#71717a] hover:text-red-400 hover:bg-[#18181c] transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-[#27272a]">
        <div className="relative">
          <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations or users..."
            className="w-full h-9 pl-9 pr-3 bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/40 rounded-xl text-xs text-[#fafafa] placeholder:text-[#52525b] outline-none transition-all duration-150"
          />
        </div>
      </div>

      {/* Conversations / Users List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto divide-y divide-[#27272a]/40"
      >
        {filteredUsers.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-[#71717a]">
            <MessageSquarePlus className="w-8 h-8 stroke-1 mb-2 text-[#52525b]" />
            <p className="text-xs">No users found</p>
            <p className="text-[11px] text-[#52525b] mt-0.5">
              Invite a peer to start messaging
            </p>
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isActive = activeUserId === u.id;
            const isUserOnline = onlineUsers.has(u.id);

            return (
              <button
                key={u.id}
                onClick={() => onSelectUser(u)}
                className={cn(
                  "user-list-item w-full px-4 py-3.5 flex items-start gap-3 text-left transition-all duration-150 cursor-pointer relative",
                  isActive
                    ? "bg-[#18181c] border-l-2 border-l-[#10b981]"
                    : "hover:bg-[#18181c]/60 border-l-2 border-l-transparent"
                )}
              >
                {/* Monogram Avatar + Live Status Dot */}
                <div className="relative shrink-0 mt-0.5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-inner"
                    style={{ backgroundColor: u.avatarColor || "#3b82f6" }}
                  >
                    {u.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  {isUserOnline && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10b981] ring-2 ring-[#121215]"
                      title="Online"
                    />
                  )}
                </div>

                {/* Info & Snippet */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={cn(
                        "text-xs font-semibold truncate",
                        isActive ? "text-[#fafafa]" : "text-[#e4e4e7]"
                      )}
                    >
                      {u.name}
                    </span>
                    {u.lastMessage?.createdAt && (
                      <span className="text-[10px] font-mono-numbers text-[#71717a] shrink-0 ml-2">
                        {formatRelativeTime(u.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-[#71717a] truncate font-normal">
                      {u.lastMessage?.content ? (
                        <>
                          {u.lastMessage.sender === currentUser?.id && (
                            <span className="text-[#a1a1aa] font-medium mr-1">
                              You:
                            </span>
                          )}
                          {u.lastMessage.content}
                        </>
                      ) : (
                        <span className="italic text-[#52525b]">
                          Start conversation
                        </span>
                      )}
                    </p>

                    {/* Unread Pill Badge */}
                    {Boolean(u.unreadCount && u.unreadCount > 0) && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono-numbers bg-[#10b981] text-[#09090b] leading-none">
                        {u.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

