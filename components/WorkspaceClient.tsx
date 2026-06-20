"use client"

import React, { useCallback, useState } from 'react'
import { CodePanel } from './CodePanel'
import { FileData, StatusStep } from '@/types/workspace';
import { ChatPanel } from './ChatPanel';
import { Message } from '@/types/workspace';

interface WorkspaceClientProps {
  initialPrompts: string | null;
  userCredits: number;
  userId: string;
  userPlan: string;
}

export const WorkspaceClient = ({
  initialPrompts,
  userCredits,
  userId,
  userPlan,
}: WorkspaceClientProps) => {
  const [workspaceId, setWorkspaceId]   = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [credits, setCredits] = useState(userCredits);


  const [fileData, setFileData] = useState<FileData | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusLog, setStatusLog] = useState<StatusStep[]>([]);

  const handleFilePatch = useCallback((patches: FileData) => {
    setFileData(patches);
  }, []);

  const handleGenerate = useCallback(
    async (prompt: string, imageUrl?: string) => {},
    [credits, isGenerating, userId],
  );

  
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
       onGenerate={handleGenerate}
       userId={userId}
       workspaceId={workspaceId} 
       appTitle={"Test Title"}
       />
        
        {/* Code panel - right */}
        <CodePanel 
        fileData={fileData}
        isGenerating={isGenerating}
        statusLog={statusLog}
        onFilePatch={handleFilePatch}
        />
    </div>
  )
}
