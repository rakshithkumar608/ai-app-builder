import { BlueTitle } from '@/components/reusables';
import { Button } from '@/components/ui/button';
import { auth } from '@clerk/nextjs/server'
import { Zap } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function ProjectsPage() {
    const {userId} = await auth();
    if (!userId) redirect("/");

  return (
    <main className='min-h-screen bg-[#0a0a0a]px-4 py-10'>
        <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <BlueTitle className='text-6xl'>Projects</BlueTitle>
                    <p className="mt-3 text-sm text-white/30">
                    All your AI-generated apps in one place.
                    </p>
                </div>

                <Link href="/">
                <Button className={"cursor-pointer"}>
                    <Zap className='h-3 w-3 fill-black'/>
                    New Project
                </Button>
                </Link>
            </div>
        </div>
    </main>
  )
}
