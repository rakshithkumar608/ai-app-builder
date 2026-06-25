import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import { db } from "@/lib/prisma";
import { FileData } from "@/types/workspace";
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { Agent, createTool } from "@cline/sdk";
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
  const { workspaceId, userId, userRequest, fileData } = body as {
    workspaceId: string;
    userId: string;
    userRequest: string;
    fileData: FileData;
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
      const patchedFiles: Record<string, { code: string }> = {
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
            .describe("File path exactly as it appears, e.g. /App.js"),
          code: z.string().describe("Complete new contents of the file"),
          reason: z
            .string()
            .describe("One sentence explaining what you changed and why"),
        }),
        async execute({ path, code, reason }) {
          patchedFiles[path] = { code };
          // Emit live patch - client applies it to Sandpack immediately
          enqueue(sseEvent("file_patch", { path, code, reason }));
          return `Updated ${path}: ${reason}`;
        },
      });

        // ── Tool 2: done_improving ───────────────────────────────────────────
      // Agent calls this when all files are updated.
      // lifecycle.completesRun: true tells the Cline SDK loop to stop
      // immediately after this tool runs instead of continuing iterations.
      const doneImprovingTool = createTool({
        name: "append_instruction",
        description:
          "Append a new step to the end of the sandbox instructions. Use this tool only once at the end of the process",
        inputSchema: z.object({
          summary: z
            .string()
            .describe(
              "A short friendly summary of all the improvements you made (1-3 sentences)",
            ),
        }),
        lifecycle: { completesRun: true },
        async execute({ summary }) {
          finalSummary = summary;
          return "Done.";
        },
      });

      //  ---Serialize current files for context ----------
      const fileContext = Object.entries(fileData.files)
        .map(([path, { code }]) => `// ${path}\n${code}`)
        .join("\n\n-----\n\n");

      const agent = new Agent({
        providerId: "openai-compatible",
        modelId: "moonshotai/kimi-k2-instruct-0905",
        apiKey: process.env.GROQ_API_KEY!,
        baseUrl: "https://api.groq.com/openai/v1",
        maxIterations: 8,
        systemPrompt: `You are an expert React developer improving a live browser preview app.

The app uses React (functional components), Tailwind CSS for styling, and runs in Sandpack.
You CANNOT use TypeScript, CSS modules, or real npm install — only what's already available.
Available packages: react, react-dom, tailwindcss (CDN), lucide-react, recharts, react-router-dom, framer-motion, date-fns, zod, react-hook-form.

Here are the current files:

${fileContext}

WORKFLOW:
1. Understand what the user wants improved.
2. Identify which files need to change.
3. Call update_file for each file that needs changes (always include the COMPLETE file, not just the diff).
4. Once all files are updated, call append_instruction with a short summary.

RULES:
- Always write complete file contents — never partial snippets.
- Keep all existing functionality unless asked to remove it.
- The entry point is always /App.js with a default export.
- All imports must reference files you've updated or packages in the available list above.`,
        tools: [updateFileTool, doneImprovingTool],
        //  Auto-approve both tools - no human-in-loop needed in this context
        toolPolicies: {
          update_file: { autoApprove: true },
          append_instruction: { autoApprove: true },
        },
      });

      try {
        //  ==== Stream agent reasoning to chat panel =======
        agent.subscribe((event) => {
          if (event.type === "assistant-text-delta" && event.text) {
            enqueue(sseEvent("thinking", { text: event.text }));
          }

          if (event.type === "tool-started") {
            const name = event.toolCall?.toolName;
            if (name === "update_file") {
              const path = 
              (event.toolCall?.input as {path?: string })?.path ?? "a file";
              enqueue(
                sseEvent("thinking", {text: `\n\nUpdating \`${path}\`...`}),
              );
            } else if (name === "append_instruction") {
              enqueue(
                sseEvent("thinking", {text: "\n\nFinalizing improvements..."}),
              );
            }
          }
        });

        // Run the agent ============
        enqueue(sseEvent("status", {message: "Groq agent starting..."}));


        const result = await agent.run(userRequest);

        if (result.status === "failed") {
          throw new Error(result.error?.message ?? "Agent run failed");
        }

        // ----- Deduct credit + save to DB-----------

        const newFileData: FileData = {
          files: patchedFiles,
          dependencies: fileData.dependencies,
          title: fileData.title,
        };

        await db.workspace.update({
          where: {id: workspaceId, userId},
          data: {fileData: newFileData as never},
        });

        await db.user.update({
          where: {id: userId},
          data: {credits: {decrement: CREDIT_COST_PER_GENERATION}},
        });

        const updateUser = await db.user.findUnique({
          where: {id: userId},
          select: {credits: true},
        });

        enqueue(
          sseEvent("done", {
            fileData: newFileData,
            summary: finalSummary || result.outputText,
            creditsRemaining:
             updateUser?.credits ?? user.credits - CREDIT_COST_PER_GENERATION,
          })
        );
      } catch (error) {
        console.error("[improve] error:", error);
        enqueue(
          sseEvent("error", {
            message: 
            error instanceof Error ? error.message : "Something went wrong."
          })
        );
      } finally {
        controller.close();
      }
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
