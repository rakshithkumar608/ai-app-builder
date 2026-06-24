import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import { db } from "@/lib/prisma";
import { FileData } from "@/types/workspace";
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { Agent, createTool} from "@cline/sdk";
import z from "zod";


//  SSE helper ------------

function sseEvent(type: string, payload: unknown): string {
  return `data: ${JSON.stringify({
    type,
    ...(payload as object),
  })}\n\n`;
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { workspaceId, userId, messages, fileData } = body as {
    workspaceId: string | null;
    userId: string;
    messages: string;
    fileData: FileData | null;
  };

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, credits: true, plan: true },
  });

  if (!user)
    return Response.json(
      {
        message: "User not found",
      },
      {
        status: 400,
      },
    );

  //   Pro-only gate
  if (user.plan !== "pro")
    return Response.json(
      {
        message: "Upgrade required",
      },
      { status: 403 },
    );

  if (user.credits < CREDIT_COST_PER_GENERATION) {
    return Response.json(
      {
        message: "Insufficient credits",
      },
      { status: 402 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

    //   Accumulate file patches as the agent calls update_file
    const patchedFiles: Record<string, {code: string}> = {
        ...fileData?.files,
    };
    let finalSummary = "";

    // Tool 1: update_file ----------------------
    // The agent calls this once per file it wants to change,
    // we immediatley emit a file_patch SSE event so Sandpack
    // updates live in the browser ass each file is patched.

    const updateFileTool = createTool({
        name: "update_file",
        description:
        "Update or rewrite a file in the React sandbox. Call once per file you need to change.",
        inputSchema: z.object({
            path: z
            .string()
            
        })
    })
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}


export const runtime = "nodejs";
export const maxDuration = 300;