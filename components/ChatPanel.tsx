"use client";

import { Message, StatusStep } from "@/types/workspace";
import { useRef, useState } from "react";
import { BlueTitle } from "./reusables";
import PricingModal from "./PricingModal";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: Message[];
  isGenerating: boolean;
  isImproving: boolean;
  statusLog: StatusStep[];
  credits: number;
  initialPrompts: string | null;
  onGenerate: (prompt: string, imageUrl?: string) => Promise<void>;
  userId: string;
  workspaceId: string | null;
  appTitle: string | null;
}

export const ChatPanel = ({
  messages,
  isGenerating,
  isImproving,
  statusLog,
  credits,
  initialPrompts,
  onGenerate,
  userId,
  workspaceId,
  appTitle,
}: ChatPanelProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [input, setInput] = useState("");
  // TODO: pendingImageUrl state - added when image upload is wired
  // TODO: isUploading state - added when image upload is wired

  const hasAutoSubmittedRef = useRef(false);
  const noCredits = credits <= 0;

  const lastMsg = messages[messages.length - 1];
  const isStreamingAssistant =
    isImproving && messages[messages.length - 1]?.role === "assistant";

  const canSubmit =
    input.trim().length > 0 && !isGenerating && !isImproving && !noCredits;

  const msgs = [
    {
      role: "user",
      content: "Build me a todo list app with dark theme",
    },
    {
      role: "assistant",
      content:
        "I've built a **Todo List app** with a clean dark theme. Here's what's include:\n\n- Add and delete todos\n- Mark todos as complete\n- Filter by All / Active / Completed\n- Smooth animations with framer-motion\n\nLet me know if you'd like any changes!",
    },
  ];

  return (
    <div className="flex w-[320px] shrink-0 flex-col bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <BlueTitle>{appTitle}</BlueTitle>
        <PricingModal reason={noCredits ? "credits" : "upgrade"}>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] transition-colors",
              noCredits
                ? "bg-red-500/15 text-red-400/80 hover:bg-red-500/25"
                : "bg-white/6 text-white/30 hover:bg-white/10 hover:text-white/50",
            )}
          >
            {noCredits
              ? "No credits · Upgrade "
              : `${credits} credit${credits !== 1 ? "s" : ""}`}
          </span>
        </PricingModal>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:hidden"
      >
        {messages.length === 0 && !isGenerating && (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-white/20">
              Describe what you want to build...
            </p>
          </div>
        )}

        <div className="space-y-4">
          {msgs.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="flex items-start justify-end gap-2">
                  <div className="max-w-[85%] space-y-1.5">
                    {/* TODO: show msg.imageUrl thumbnail if present */}
                    <div className="rounded-2xl rounded-br-sm bg-white/10 px-3.5 py-2.5">
                      <p className="text-[13px] leading-relaxed text-white/80 wrap-break-word">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="rounded-2xl rounded-br-sm bg-white/10 px-3.5 py-2.5">
                    <p className="text-[13px] leading-relaxed text-white/80 wrap-break-word">
                      {msg.content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
