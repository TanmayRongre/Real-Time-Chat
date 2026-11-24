import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { ArrowLeft, Send, Sparkles, Loader2 } from "lucide-react";
import { User, Message } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { MessageBubble } from "./MessageBubble";
import { formatLastSeen } from "../../utils/date";
import { cn } from "../../utils/cn";

interface ChatWindowProps {
  recipient: User;
  conversationId: string | null;
  messages: Message[];
  loadingMessages: boolean;
  onSendMessage: (content: string) => void;
  onBack: () => void;
  isRecipientTyping: boolean;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  recipient,
  messages,
  loadingMessages,
  onSendMessage,
  onBack,
  isRecipientTyping,
  onTypingStart,
  onTypingStop,
}) => {
  const { user: currentUser } = useAuth();
  const { onlineUsers } = useSocket();
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isOnline = onlineUsers.has(recipient.id);

  // Auto-scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom("auto");
  }, [recipient.id]);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages.length, isRecipientTyping]);

  // Handle typing keystrokes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    onTypingStart();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop();
    }, 2000);
  };

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInputText("");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTypingStop();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#09090b] relative overflow-hidden">
      {/* Top Chat Header */}
      <header className="h-16 px-4 sm:px-6 border-b border-[#27272a] bg-[#121215]/90 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-2 rounded-lg text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181c] transition-colors cursor-pointer"
            title="Back to conversation list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Recipient Avatar */}
          <div className="relative shrink-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-inner"
              style={{ backgroundColor: recipient.avatarColor || "#3b82f6" }}
            >
              {recipient.name?.charAt(0).toUpperCase() || "?"}
            </div>
            {isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10b981] ring-2 ring-[#121215]" />
            )}
          </div>

          {/* Recipient Identity & Status */}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-[#fafafa] tracking-tight truncate">
              {recipient.name}
            </span>

            <div className="flex items-center gap-1.5 text-xs">
              {isRecipientTyping ? (
                <div className="flex items-center gap-1 text-[#10b981] font-medium animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  <span>typing...</span>
                </div>
              ) : isOnline ? (
                <span className="text-[#10b981] font-medium flex items-center gap-1">
                  Online
                </span>
              ) : (
                <span className="text-[#71717a] font-mono-numbers">
                  {formatLastSeen(recipient.lastSeen)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#18181c] border border-[#27272a] text-[11px] text-[#71717a]">
            <Sparkles className="w-3 h-3 text-[#10b981]" />
            <span>Encrypted Room</span>
          </div>
        </div>
      </header>

      {/* Message Feed Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col justify-start">
        {loadingMessages ? (
          <div className="flex-1 flex items-center justify-center text-[#71717a] gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-[#10b981]" />
            <span>Loading message history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#71717a] select-none">
            <div className="w-10 h-10 rounded-xl bg-[#18181c] border border-[#27272a] flex items-center justify-center text-[#52525b] mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs text-[#fafafa] font-medium">No messages yet</p>
            <p className="text-[11px] text-[#71717a] mt-1 max-w-xs">
              Say hello to {recipient.name}. Messages are transmitted instantly and synced across sessions.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, index) => {
              const isSender = msg.sender === currentUser?.id;
              // Animate only the most recent message if sent in current session
              const animate = index === messages.length - 1;

              return (
                <MessageBubble
                  key={msg.id || index}
                  message={msg}
                  isSender={isSender}
                  animate={animate}
                />
              );
            })}
          </div>
        )}

        {/* Live typing indicator bubble in feed */}
        {isRecipientTyping && (
          <div className="flex w-full my-1.5 justify-start">
            <div className="bg-[#18181c] border border-[#27272a] rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5 text-xs text-[#a1a1aa]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer Area */}
      <div className="p-3 sm:p-4 border-t border-[#27272a] bg-[#121215]/80 backdrop-blur-md shrink-0">
        <div className="flex items-end gap-2.5 max-w-4xl mx-auto">
          <div className="flex-1 relative bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] focus-within:border-[#10b981] focus-within:ring-1 focus-within:ring-[#10b981]/40 rounded-2xl transition-all duration-150">
            <textarea
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${recipient.name}... (Enter to send)`}
              className="w-full max-h-32 min-h-[44px] py-3 px-4 bg-transparent text-sm text-[#fafafa] placeholder:text-[#52525b] outline-none resize-none leading-relaxed"
              style={{
                height: "auto",
              }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={cn(
              "h-11 w-11 rounded-2xl flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer",
              inputText.trim()
                ? "bg-[#10b981] text-[#09090b] hover:bg-[#059669] shadow-sm active:scale-95"
                : "bg-[#18181c] text-[#52525b] border border-[#27272a] opacity-50 cursor-not-allowed"
            )}
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

