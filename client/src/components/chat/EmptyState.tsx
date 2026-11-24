import React from "react";
import { MessageSquare, Lock, Zap } from "lucide-react";

export const EmptyState: React.FC = () => {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-8 bg-[#09090b] text-[#fafafa] text-center select-none">
      <div className="max-w-md w-full p-8 rounded-2xl bg-[#121215] border border-[#27272a] shadow-xl flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] mb-5">
          <MessageSquare className="w-6 h-6" />
        </div>

        <h2 className="text-base font-semibold text-[#fafafa] tracking-tight">
          No Conversation Selected
        </h2>
        <p className="mt-1.5 text-xs text-[#a1a1aa] leading-relaxed">
          Select a contact from the sidebar or search by name to inspect live presence and exchange instant messages.
        </p>

        <div className="grid grid-cols-2 gap-3 w-full mt-6 pt-6 border-t border-[#27272a]">
          <div className="p-3 rounded-xl bg-[#09090b] border border-[#27272a]/60 text-left">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#fafafa]">
              <Zap className="w-3.5 h-3.5 text-[#10b981]" />
              <span>Real-Time</span>
            </div>
            <p className="text-[11px] text-[#71717a] mt-1">
              Live typing indicators, presence detection, and read receipts.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#09090b] border border-[#27272a]/60 text-left">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#fafafa]">
              <Lock className="w-3.5 h-3.5 text-[#10b981]" />
              <span>Persisted</span>
            </div>
            <p className="text-[11px] text-[#71717a] mt-1">
              Encrypted session records persisted to MongoDB.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

