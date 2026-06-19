import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import React from 'react'

interface WorkspacePageProps {
    searchParams: Promise<{ prompt?: string; id?: string }>;
}

const WorkspacePage = async ({ searchParams } : WorkspacePageProps) => {
    const { userId } = await auth();
    if (!userId) redirect("/");

    const { prompt, id } = await searchParams;
  return (
    <div>
      <p>
        workspace - prompt: {prompt}, id: {id}
      </p>
    </div>
  )
}

export default WorkspacePage
