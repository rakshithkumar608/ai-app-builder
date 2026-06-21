import { WorkspaceClient } from '@/components/WorkspaceClient';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

interface WorkspacePageProps {
  searchParams: Promise<{
    prompt?: string;
    id?: string;
  }>;
}

export default async function WorkspacePage({
  searchParams,
}: WorkspacePageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  const { prompt, id } = await searchParams;

  let workspace = null;

  return (
    <WorkspaceClient
      initialPrompts={prompt ?? null}
      userCredits={10}
      userId={userId}
      userPlan='free'
    />
  );
}