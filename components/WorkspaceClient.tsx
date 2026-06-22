"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CodePanel } from './CodePanel'
import { FileData, StatusStep, WorkspaceData } from '@/types/workspace';
import { ChatPanel } from './ChatPanel';
import { Message } from '@/types/workspace';
import { MIN_CREDITS_TO_GENERATE } from '@/lib/constants';
import { toast } from 'sonner';

interface WorkspaceClientProps {
  initialPrompts: string | null;
  userCredits: number;
  userId: string;
  userPlan: string;
  workspace: WorkspaceData | null;
  isImproving: boolean;
}

function parseMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter(
    (m): m is Message => 
      typeof m === "object" && m !== null && "role" in m && "content" in m,
  );
}

function parseFileData(raw: unknown): FileData | null {
  if (!raw || typeof raw !== "object") return null;

  const f = raw as Record<string, unknown>;

  if (!f.files || !f.dependencies) return null; 

  return raw as FileData;
}

export const WorkspaceClient = ({
  initialPrompts,
  userCredits,
  workspace,
  userId,
  userPlan,
}: WorkspaceClientProps) => {
  const [workspaceId, setWorkspaceId]   = useState<string | null>(workspace?.id ?? null);
  const [messages, setMessages] = useState<Message[]>(
    parseMessages(workspace?.messages),
  );
  const [credits, setCredits] = useState(userCredits);

  const [fileData, setFileData] = useState<FileData | null>(parseFileData(workspace?.fileData));


  const [isGenerating, setIsGenerating] = useState(false);
  const [statusLog, setStatusLog] = useState<StatusStep[]>([]);
  const [isImproving, setIsImproving] = useState(false)

  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fileDataRef = useRef<FileData | null>(fileData);
  useEffect(() => {
    fileDataRef.current = fileData;
  }, [fileData]);

  const workspaceIdRef = useRef<string | null>(workspaceId);
  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  // AbortController refs - used to cancle in-flight streams
  const generateAbortRef = useRef<AbortController | null>(null);
  const improveAbortRef = useRef<AbortController | null>(null);

  const handleFilePatch = useCallback((patches: FileData) => {
    setFileData(patches);
  }, []);

  const pushStep = (label: string) => {
    setStatusLog((prev) => [
      ...prev.map((s, i) => 
      i === prev.length - 1 ? {...s, status: "done" as const} : s, ),
      {label, status: "running" as const},
    ]);
  };

  const completeSteps = () => {
    setStatusLog((prev) => 
      prev.map((s, i) =>
      i === prev.length -1 ? {...s, status: "done"} : s),
    );
  };

  const handleGenerate = useCallback(
    async (prompt: string, imageUrl?: string) => {
      if (isGenerating) return;
      if (credits < MIN_CREDITS_TO_GENERATE) return;

      const userMessages:Message = {
        role: "user",
        content: prompt,
        ...(imageUrl ? { imageUrl } : {}),
      };

      const currentMessages = messagesRef.current;
      const currentWorkspaceId = workspaceIdRef.current;

      setMessages((prev) => [...prev, userMessages]);
      setIsGenerating(true);
      setStatusLog([{ label: "Thinking...", status: "running" }])

      // Create a new abort controller for this generation request
      const abortController = new AbortController();
      generateAbortRef.current = abortController;

      try {
        const res = await fetch("/api/gen-ai-code", {
          method: "POST",
          headers: { "Content-Type" : "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            workspaceId: currentWorkspaceId,
            userId,
            messages: [...currentMessages, userMessages],
            fileData: fileDataRef.current,
          }),
        });

        if (res.status == 402) {
          toast.error("Not enough credits");
          setMessages((prev) => prev.slice(0, -1));
          return;
        }

        if (res.status === 429) {
          toast.error("Too many requests, please try again later");
          setMessages((prev) => prev.slice(0, -1));
          return;
        }

        if (!res.ok || !res.body) throw new Error("Generation failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const {done, value} = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, {stream: true});
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              // Strip the "data:" prefix (6 characters) and parse the JSON payload
              const event = JSON.parse(line.slice(6));

              if (event.type === "status") {
                // Gemini thought label - adds a new step to the status log
                //  e.g. "Designing layout...", "Adding interactivity"
                pushStep(event.message);
              } else if (event.type === "done") {
                completeSteps();
                setWorkspaceId(event.workspaceId);
                setFileData(event.fileData);
                setCredits(event.creditsRemaining);
                setMessages((prev) => [
                  ...prev,
                  {role: "assistant", content: event.assistantMessage},
                ]);
                window.history.replaceState(
                  null,
                  "",
                  `/workspace?id=${event.workspaceId}`
                );
              } else if (event.type === "error") {
                // Re-throw so it escapes to the outer catch and shows a toast
                throw Object.assign(new Error(event.message ?? "Generation failed"), { __sse: true });
              }
            } catch (error) {
              // Re-throw SSE error events — only skip malformed JSON lines
              if (error instanceof Error && (error as Error & { __sse?: boolean }).__sse) throw error;
              // skip malformed SSE lines
            }
          }
        }
      } catch (error) {
        // User-initiated stop - silently roll back the user message
        if (error instanceof Error && error.name === "AbortError") {
          setMessages((prev) => prev.slice(0, -1));
          return; 
        }
        toast.error(
          error instanceof Error ? error.message : "Something went wrong.",
        );
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        generateAbortRef.current = null;
        setIsGenerating(false);
        setStatusLog([]);
      }
    },
    [credits, isGenerating, userId],
  );

  const handleStop = useCallback(() => {
    generateAbortRef.current?.abort();
    improveAbortRef.current?.abort();
  }, [])

  
  return (
    <div className='flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0a]'>
        {/* Chat panel - left */}
       <ChatPanel
       messages={messages}
       isGenerating={isGenerating}
       isImproving={false}
       statusLog={statusLog}
       credits={credits}
       initialPrompts={initialPrompts}
       onStop={handleStop}
       onGenerate={handleGenerate}
       userId={userId}
       workspaceId={workspaceId} 
       appTitle={fileData?.title ?? workspace?.title ?? null}
       />
        
        {/* Code panel - right */}
        <CodePanel 
        fileData={fileData}
        isGenerating={isGenerating}
        statusLog={statusLog}
        onFilePatch={handleFilePatch}
        isImproving={isImproving}
        onFixError={(error) => 
          handleGenerate(
            `There is an error in the preview:\n\n\`\`\n${error}\n\`\`\`\n\n Please fix it.`,
          )
        }
        />
    </div>
  )
}
