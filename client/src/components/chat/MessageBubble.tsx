import React, { useRef } from "react";
import { Check, CheckCheck } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Message } from "../../types";
import { formatMessageTime } from "../../utils/date";
import { cn } from "../../utils/cn";

interface MessageBubbleProps {
  message: Message;
  isSender: boolean;
  animate?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSender,
  animate = true,
}) => {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (animate && bubbleRef.current) {
        gsap.from(bubbleRef.current, {
          opacity: 0,
          y: 8,
          duration: 0.25,
          ease: "power2.out",
        });
      }
    },
    { scope: bubbleRef, dependencies: [animate] }
  );

  return (
    <div
      ref={bubbleRef}
      className={cn("flex w-full my-1.5", isSender ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[82%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl px-4 py-2.5 text-sm transition-all relative break-words shadow-sm",
          isSender
            ? "bg-[#142820] border border-[#10b981]/25 text-[#fafafa] rounded-br-sm"
            : "bg-[#18181c] border border-[#27272a] text-[#f4f4f5] rounded-bl-sm"
        )}
      >
        {/* Message Content */}
        <p className="whitespace-pre-wrap leading-relaxed selection:bg-[#10b981]/30">
          {message.content}
        </p>

        {/* Timestamp & Status Metadata */}
        <div
          className={cn(
            "flex items-center gap-1.5 mt-1 select-none font-mono-numbers text-[10px]",
            isSender ? "justify-end text-[#10b981]/80" : "justify-start text-[#71717a]"
          )}
        >
          <span>{formatMessageTime(message.createdAt)}</span>

          {isSender && (
            <span className="inline-flex items-center" title={`Status: ${message.status}`}>
              {message.status === "sent" && (
                <Check className="w-3 h-3 text-[#71717a]" />
              )}
              {message.status === "delivered" && (
                <CheckCheck className="w-3.5 h-3.5 text-[#a1a1aa]" />
              )}
              {message.status === "read" && (
                <CheckCheck className="w-3.5 h-3.5 text-[#10b981]" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

