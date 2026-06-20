import React from 'react'

export const WorkspaceClient = () => {
  return (
    <div className='flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0a]'>
        {/* Chat panel - left */}
        <div className="w-[320px] shrink-0 border-r border-white/6 bg-[#0d0d0d] flex items-center justfiy-center">
        <p className="text-xs text-white/20">
        Chat panel comming soon
        </p>
        </div>

        {/* Code panel - right */}
        <div className="flex flex-1 flex-col overflow-hidden items-center justify-center">
            <p className="text-xs text-white/20">
            Code panel comming soon
            </p>
        </div>
    </div>
  )
}
